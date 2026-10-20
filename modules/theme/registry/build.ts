import { createHash, randomBytes } from 'node:crypto'
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, realpathSync, renameSync, rmSync, statSync, writeSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { checkTheme, formatIssue } from '../check'
import type { Hooks, InstalledTheme } from '../types'
import { MAX_ENTRIES, MAX_FILE_BYTES } from './constants'
import { PackError, UnpackError } from './error'
import { gzipDeterministic } from './gzip'
import { packProblems } from './pack'
import { isAllowedPath, pathProblem } from './paths'
import { writeTar } from './tar'
import { unpackOwnTheme } from './unpack'
import type { PackageManifest } from './types'

// `npm run theme:pack` (#309): validate, collect the allowlisted files, write a deterministic tgz and its manifest, and unpack it again to prove it

/** A packed theme: the `.tgz` (whose digest is the trust anchor) and its informative manifest. */
export interface BuiltPackage {
  /** `<id>-<version>.tgz` */
  tgzName: string
  tgz: Buffer
  /** `sha256:<hex>` of the `.tgz`. */
  digest: string
  /** `<id>-<version>.manifest.json` */
  manifestName: string
  manifest: PackageManifest
}

/** Every file under `dir` as a package path; a symlink, a device, a hidden or misplaced file is reported and not followed. */
function collectFiles(dir: string, prefix: string, problems: string[]): string[] {
  const found: string[] = []
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = `${prefix}${entry.name}`
    if (entry.isSymbolicLink()) problems.push(`${path}: is a symlink; copy the file instead`)
    else if (entry.isDirectory()) {
      const bad = pathProblem(path)
      if (bad) problems.push(bad.message)
      else if (!isAllowedPath(path, 'directory')) problems.push(`allowlist: ${path}: is not a folder a theme package may hold`)
      else found.push(...collectFiles(dir, `${path}/`, problems))
    } else if (entry.isFile()) found.push(path)
    else problems.push(`${path}: is not a regular file`)
  }
  return found
}

/** The device and inode of a file as listed, to tell a later read that the file is the same one. */
interface Identity {
  dev: bigint
  ino: bigint
  /** The same for the folder the file was listed in. */
  folder?: { dev: bigint, ino: bigint }
}

/** Where `theme:pack` writes, relative to the repository root. `dist/` is Nuxt's, a link to `.output/public`. */
const PACK_OUT_DIR = '.micelio/packages'

function listPackageFiles(dir: string): { files: string[], identities: Map<string, Identity>, problems: string[] } {
  const problems: string[] = []
  const files = collectFiles(dir, '', problems)
  for (const path of files) {
    const bad = pathProblem(path)
    if (bad) problems.push(bad.message)
    else if (!isAllowedPath(path, 'file')) problems.push(`allowlist: ${path}: is not a file a theme package may hold`)
  }
  if (files.length > MAX_ENTRIES) problems.push(`entries: the package has ${files.length} files; the limit is ${MAX_ENTRIES}`)
  const identities = new Map<string, Identity>()
  for (const path of files) {
    const { dev, ino } = lstatSync(join(dir, path), { bigint: true })
    const folder = statSync(dirname(join(dir, path)), { bigint: true })
    identities.set(path, { dev, ino, folder: { dev: folder.dev, ino: folder.ino } })
  }
  return { files: files.sort((a, b) => (a < b ? -1 : 1)), identities, problems }
}

/**
 * Reads one file of a theme from an open descriptor, so what is checked is what is read: its folder resolves inside the theme, it
 * is not a symlink (`O_NOFOLLOW`), it is a regular file (`O_NONBLOCK` keeps a FIFO from blocking the open) with one link and at
 * most 1 MiB, known from `fstat` before any byte is read, and, when `listed` is given, it is the file that was listed.
 *
 * @param root - The theme folder.
 * @param path - The package path of the file, relative to `root`.
 * @param listed - The device and inode `lstat` reported when the file was listed; a different file at the same path is refused.
 * @returns The bytes, or the reason the file cannot go in a package.
 * @internal Exported for tests.
 */
export function readPackageFile(root: string, path: string, listed?: Identity): { data: Buffer } | { problem: string } {
  const file = join(root, path)
  try {
    const parent = realpathSync(dirname(file))
    const base = realpathSync(root)
    if (parent !== base && !parent.startsWith(base + sep)) return { problem: `${path}: its folder resolves outside the theme folder` }
    const folder = statSync(parent, { bigint: true })
    if (listed?.folder && (folder.dev !== listed.folder.dev || folder.ino !== listed.folder.ino)) return { problem: `${path}: its folder is not the one that was listed (it changed while packing)` }
  } catch (error) {
    return { problem: `${path}: cannot be opened (${String((error as NodeJS.ErrnoException).code)})` }
  }
  let fd: number
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return { problem: code === 'ELOOP' || code === 'EMLINK' ? `${path}: is a symlink; copy the file instead` : `${path}: cannot be opened (${String(code)})` }
  }
  try {
    const stats = fstatSync(fd, { bigint: true })
    if (!stats.isFile()) return { problem: `${path}: is not a regular file` }
    if (listed && (stats.dev !== listed.dev || stats.ino !== listed.ino)) return { problem: `${path}: is not the file that was listed (it changed while packing)` }
    if (stats.nlink > 1n) return { problem: `${path}: has ${stats.nlink} hard links; copy the file instead` }
    if (stats.size > BigInt(MAX_FILE_BYTES)) return { problem: `file-size: ${path}: is ${stats.size} bytes; the limit is ${MAX_FILE_BYTES}` }
    const data = Buffer.alloc(Number(stats.size))
    let read = 0
    while (read < data.length) {
      const count = readSync(fd, data, read, data.length - read, read)
      if (count === 0) break
      read += count
    }
    if (read !== data.length || readSync(fd, Buffer.alloc(1), 0, 1, read) !== 0) return { problem: `${path}: changed while it was being read` }
    return { data }
  } finally {
    closeSync(fd)
  }
}

/** Why the theme cannot be packed yet: `version` and `license`, then the errors of `theme:check` (contract, contrast, budgets). */
function themeProblemsToPack(theme: InstalledTheme, hooks: Hooks): { problems: string[], report: ReturnType<typeof checkTheme> } {
  const report = checkTheme(theme, hooks)
  return { report, problems: [...packProblems(theme.manifest), ...report.errors.map(issue => formatIssue(theme.id, issue))] }
}

/**
 * Packs an installed theme: the same validation as the build, `theme:check` and `packProblems`, then a deterministic `.tgz`.
 *
 * @remarks
 * Files are read through `readPackageFile`. The package is then unpacked again with the safe unpack, and a second time against its
 * own manifest, which proves the manifest against the files it was made from: what is written is what a registry client accepts.
 * Entries are sorted by path with fixed owner, mtime and mode, and the gzip has no timestamp: packing twice on the same Node
 * gives the same digest. Another Node or zlib may deflate to other bytes; the digest of record is that of the published `.tgz`.
 * The mode of a file on disk is not kept (every file is `0644`), and empty folders are left out.
 *
 * @throws `PackError` listing every problem, when the theme does not validate or holds a file the package may not.
 */
export function buildPackage(theme: InstalledTheme, hooks: Hooks): BuiltPackage {
  const { problems, report } = themeProblemsToPack(theme, hooks)
  const listed = listPackageFiles(theme.dir)
  problems.push(...listed.problems)
  if (problems.length) throw new PackError(theme.id, problems)
  const { version, license } = theme.manifest
  if (version === undefined || license === undefined) throw new PackError(theme.id, packProblems(theme.manifest))
  const contents: Array<{ path: string, data: Uint8Array }> = []
  const unreadable: string[] = []
  for (const path of listed.files) {
    const read = readPackageFile(theme.dir, path, listed.identities.get(path))
    if ('problem' in read) unreadable.push(read.problem)
    else contents.push({ path, data: read.data })
  }
  if (unreadable.length) throw new PackError(theme.id, unreadable)
  const tgz = gzipDeterministic(writeTar(contents))
  let unpacked
  try {
    unpacked = unpackOwnTheme(tgz)
  } catch (error) {
    if (error instanceof UnpackError) throw new PackError(theme.id, [error.message])
    throw error
  }
  const files = [...unpacked.files].map(([path, data]) => ({ path, size: data.length, sha256: createHash('sha256').update(data).digest('hex') }))
  if (!report.contract) throw new PackError(theme.id, ['the contract usage is unknown: theme.json is not valid'])
  const manifest: PackageManifest = {
    id: theme.id,
    name: theme.manifest.name ?? theme.id,
    version,
    contract: { declared: report.contract.declared, used: report.contract.used },
    license,
    code: unpacked.code,
    files,
    size: unpacked.size,
    check: { errors: 0, warnings: report.warnings.map(issue => formatIssue(theme.id, issue)) },
  }
  try {
    unpackOwnTheme(tgz, { manifest: JSON.stringify(manifest) })
  } catch (error) {
    if (error instanceof UnpackError) throw new PackError(theme.id, [error.message])
    throw error
  }
  return { tgzName: `${theme.id}-${version}.tgz`, tgz, digest: unpacked.digest, manifestName: `${theme.id}-${version}.manifest.json`, manifest }
}

/** Writes `content` to a new temporary file next to `file` (exclusive, no symlink, synced), then renames it over `file`. */
function writeThenRename(file: string, content: Uint8Array | string): void {
  if (lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`${file} is a symlink; remove it so the package is not written through it`)
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`
  let fd: number
  try {
    fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o644)
  } catch (error) {
    throw new Error(`Cannot write ${file} (${String((error as NodeJS.ErrnoException).code)})`, { cause: error })
  }
  try {
    try {
      const bytes = typeof content === 'string' ? Buffer.from(content) : content
      for (let written = 0; written < bytes.length;) written += writeSync(fd, bytes, written, bytes.length - written)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(temporary, file)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

/**
 * Writes the `.tgz` and its manifest into `<root>/.micelio/packages`, creating it, and returns their paths.
 *
 * @remarks
 * An existing file of the same name is replaced: a local rebuild is not a published version, which never changes (ADR 0008).
 * Each file is written under a temporary name and renamed over the target, so a half-written file is never left under the final
 * name and a hard link to another file is replaced, not written through. The folder must resolve to `.micelio/packages` under the
 * real `root` (a symlinked `.micelio` fails), and a symlink at either file path is an error.
 *
 * @param root - The repository root.
 * @param relativeDir - The output folder under `root`.
 * @throws `Error` when the folder resolves elsewhere, a file path is a symlink, or a file cannot be written.
 */
export function writePackage(built: BuiltPackage, root: string, relativeDir: string = PACK_OUT_DIR): { tgz: string, manifest: string } {
  const dir = join(root, relativeDir)
  let step = root
  for (const segment of relativeDir.split('/')) {
    step = join(step, segment)
    if (lstatSync(step, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`${step} is a symlink; remove it so the package stays inside the repository`)
    mkdirSync(step, { recursive: true })
  }
  const expected = join(realpathSync(root), relativeDir)
  if (realpathSync(dir) !== expected) throw new Error(`${dir} resolves to ${realpathSync(dir)}, not ${expected}; remove the link so the package stays inside the repository`)
  const tgz = join(dir, built.tgzName)
  const manifest = join(dir, built.manifestName)
  writeThenRename(tgz, built.tgz)
  writeThenRename(manifest, `${JSON.stringify(built.manifest, null, 2)}\n`)
  return { tgz, manifest }
}
