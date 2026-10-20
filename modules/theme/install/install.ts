import { createHash } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { checkTheme } from '../check'
import { isCodePath } from '../registry/paths'
import { checkIdentity } from '../registry/materialize'
import { pinProblem } from '../registry/pin'
import { UnpackError, RegistryError } from '../registry/error'
import { unpackTheme } from '../registry/unpack'
import type { ThemePin } from '../registry/types'
import { THEME_JSON } from '../registry/constants'
import type { InstalledTheme, ThemeManifest } from '../types'
import { compileKey, compiledDigest, compileTheme } from './compile'
import { MAX_ENTRY_BYTES } from './constants'
import { InstallError } from './error'
import { buildEntryManifest, loadEntry, privateTemp, readKeptPackage, writeEntry } from './store'
import type { InstallOptions, InstallResult, InstallSource, LoadedEntry } from './types'

function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex')
}

/** Every regular file of a theme folder as a path with `/` separators; a symlink is an error. */
function folderFiles(dir: string, prefix = ''): string[] {
  const found: string[] = []
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = `${prefix}${entry.name}`
    if (entry.isSymbolicLink()) throw new InstallError('source', {}, `${path} is a symlink; copy the file instead`)
    if (entry.isDirectory()) found.push(...folderFiles(dir, `${path}/`))
    else if (entry.isFile()) found.push(path)
  }
  return found
}

function readManifest(dir: string): ThemeManifest {
  try {
    return JSON.parse(readFileSync(join(dir, THEME_JSON), 'utf8')) as ThemeManifest
  } catch {
    throw new InstallError('source', {}, 'theme.json is missing or is not valid JSON')
  }
}

/** Writes the verified files of a package to a private folder (mode 0700, files created exclusively), so the validator and the compiler read a folder. */
async function writeSource(dir: string, files: Map<string, Uint8Array>): Promise<string> {
  for (const [path, data] of files) {
    const file = resolve(dir, path)
    if (!file.startsWith(dir + sep)) throw new InstallError('package', {}, 'a file would be written outside the theme folder')
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, data, { mode: 0o600, flag: 'wx' })
  }
  return dir
}

/**
 * Installs a theme into the store: unpack, validate, compile, write atomically.
 *
 * @remarks
 * ADR 0009, section 2. A package is unpacked against its pinned digest by the safe unpack (nothing is read by path after the digest
 * verified), checked to be the theme the pin names, and refused when it ships code unless `allowCode`. Every source then goes through the
 * contract validator and the error-level checks of `theme:check` (contrast, budgets), whose problems are listed in the error, and
 * is compiled by `compileTheme`. A theme that fails any step never reaches the store. Nothing from the theme is executed or imported.
 * Installing the same source twice gives identical bytes and the second call reports `created: false`.
 *
 * @throws `InstallError` whose `rule` says which step failed; the message names the theme, version and digest, never a path.
 */
export async function installTheme(source: InstallSource, options: InstallOptions): Promise<InstallResult> {
  let dir: string
  let packageDigest: string
  let code: boolean
  let tgz: Uint8Array | undefined
  let temporary: string | undefined
  try {
    if (source.kind === 'package') {
      const problem = pinProblem(source.pin)
      if (problem !== null) throw new InstallError('pin', {}, problem)
      const pin = { id: source.pin.id, version: source.pin.version, digest: source.pin.digest }
      let unpacked
      try {
        unpacked = unpackTheme(source.data, { digest: source.pin.digest })
        checkIdentity(source.pin, unpacked)
      } catch (error) {
        if (error instanceof UnpackError) throw new InstallError('package', pin, error.message, { cause: error })
        if (error instanceof RegistryError) throw new InstallError('identity', pin, error.detail, { cause: error })
        throw error
      }
      packageDigest = unpacked.digest
      code = unpacked.code
      tgz = source.data
      temporary = await writeSource(await privateTemp(options.storeDir, 'source-'), unpacked.files)
      dir = temporary
    } else {
      dir = resolve(source.dir)
      let files: string[]
      try {
        files = folderFiles(dir)
      } catch (error) {
        if (error instanceof InstallError) throw error
        throw new InstallError('source', {}, 'the theme folder cannot be read', { cause: error })
      }
      if (!files.includes(THEME_JSON)) throw new InstallError('source', {}, 'the folder has no theme.json')
      packageDigest = `sha256:${sha256(files.map(path => `${path}\0${sha256(readFileSync(join(dir, path)))}\n`).join(''))}`
      code = files.some(isCodePath)
    }
    const manifest = readManifest(dir)
    const theme: InstalledTheme = { id: String(manifest.id), dir, manifest }
    const subject = { id: theme.id, version: manifest.version, digest: packageDigest }
    if (code && !options.allowCode) throw new InstallError('code', subject, 'the theme ships code (slots/ or templates/), which only an image built with it can run')
    const report = checkTheme(theme, options.hooks)
    if (report.errors.length) throw new InstallError('validation', subject, report.errors.map(issue => issue.message).join('; ').replaceAll(dir, '.'))
    const compiled = await compileTheme({ theme, packageDigest, code, coreBuild: options.coreBuild })
    const total = [...compiled.files].reduce((sum, [path, data]) => sum + (/\.(gz|br)$/.test(path) ? 0 : data.length), 0)
    if (total > MAX_ENTRY_BYTES) throw new InstallError('compile', subject, `the compiled theme is ${total} bytes before compression; the limit is ${MAX_ENTRY_BYTES}`)
    const entry = buildEntryManifest({
      id: theme.id,
      version: manifest.version ?? '',
      digest: compiled.digest,
      packageDigest,
      compileKey: compiled.compileKey,
      contract: String(report.contract?.declared ?? manifest.contract),
      code,
      origin: source.kind,
    }, compiled.files)
    const { created } = await writeEntry(options.storeDir, entry, compiled.files, { tgz, attestation: source.kind === 'package' ? source.attestation : undefined })
    return { digest: compiled.digest, packageDigest, created, manifest: entry, warnings: compiled.warnings }
  } finally {
    if (temporary !== undefined) await rm(temporary, { recursive: true, force: true })
  }
}

/**
 * The compiled entry of a pinned package, when the store holds it as an installed theme, or `null`.
 *
 * @remarks
 * ADR 0009, section 1: an entry counts as installed only when its package digest is the pin, the kept package hashes to that digest
 * (a planted folder with a matching manifest and no verified package is not installed), the compile key is this core's, `verify`
 * accepts the kept attestation bundle when given, and then the manifest verifies. Anything less answers `null`.
 *
 * @param verify - Verifies the kept attestation bundle offline; it throws to refuse. A caller that requires attestations passes it.
 */
export async function installedEntry(storeDir: string, pin: ThemePin, coreBuild: string, verify?: (bundle: Uint8Array) => void): Promise<LoadedEntry | null> {
  if (pinProblem(pin) !== null) return null
  const kept = await readKeptPackage(storeDir, pin.digest)
  if (kept === null) return null
  if (verify) {
    if (kept.attestation === null) return null
    try {
      verify(kept.attestation)
    } catch {
      return null
    }
  }
  let entry: LoadedEntry | null
  try {
    entry = await loadEntry(storeDir, compiledDigest(pin.digest, compileKey(coreBuild)))
  } catch (error) {
    if (error instanceof InstallError) return null
    throw error
  }
  if (entry === null || entry.manifest.packageDigest !== pin.digest || entry.manifest.origin !== 'package') return null
  return entry
}
