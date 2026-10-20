import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { chmod, lstat, mkdir, mkdtemp, open, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { COMPILED_DIGEST, ENTRY_MANIFEST, INSTALL_LEASE_MS, MAX_ENTRY_MANIFEST_BYTES, MAX_LOADED_BYTES, STORE_DIR, STORE_VERSION } from './constants'
import { InstallError } from './error'
import type { EntryFile, EntryManifest, LoadedEntry } from './types'

// The theme store (ADR 0009, section 1): <root>/v1/entries/<digest>/ per compiled entry, packages/<hex>/ for the verified packages
// they came from, and .tmp/ for staging and locks. Only the installer's uid writes it.

const PACKAGE_FILE = 'package.tgz'
const ATTESTATION_FILE = 'attestation.json'

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

function layout(storeDir: string): { root: string, entries: string, packages: string, tmp: string } {
  const root = join(resolve(storeDir), STORE_DIR)
  return { root, entries: join(root, 'entries'), packages: join(root, 'packages'), tmp: join(root, '.tmp') }
}

/** A path under `parent` named by a validated digest, checked to stay inside it. */
function under(parent: string, name: string): string {
  const path = join(parent, name)
  if (!path.startsWith(parent + sep)) throw new InstallError('store', {}, 'a store path leaves the store')
  return path
}

function entryDir(storeDir: string, digest: string): string {
  if (!COMPILED_DIGEST.test(digest)) throw new InstallError('store', {}, 'the entry digest is malformed')
  return under(layout(storeDir).entries, digest)
}

function packageDir(storeDir: string, packageDigest: string): string {
  if (!/^sha256:[0-9a-f]{64}$/.test(packageDigest)) throw new InstallError('store', {}, 'the package digest is malformed')
  return under(layout(storeDir).packages, packageDigest.slice('sha256:'.length))
}

/** A new private folder (mode 0700) in the store's staging area, on the store's file system; the caller removes it. */
export async function privateTemp(storeDir: string, prefix: string): Promise<string> {
  const { tmp } = layout(storeDir)
  await mkdir(tmp, { recursive: true, mode: 0o700 })
  return mkdtemp(join(tmp, prefix))
}

/** The manifest of a compiled entry for the given files. */
export function buildEntryManifest(fields: Omit<EntryManifest, 'storeVersion' | 'files'>, files: Map<string, Buffer>): EntryManifest {
  const listed: Record<string, EntryFile> = {}
  for (const [path, data] of files) listed[path] = { size: data.length, sha256: sha256(data) }
  return { storeVersion: STORE_VERSION, ...fields, files: listed }
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`
    if (entry.isDirectory()) found.push(...await listFiles(dir, `${path}/`))
    else if (entry.isFile()) found.push(path)
    else throw new InstallError('integrity', {}, `${path} is not a regular file`)
  }
  return found.sort()
}

/**
 * Reads a compiled entry and verifies every file against its manifest, or answers `null` when there is no such entry.
 *
 * @remarks
 * Refuses (never serves in part) an entry whose manifest is for another digest or layout, that holds a file the manifest does not
 * list, or whose files differ in size or sha256. The bytes returned are the bytes verified: serve them, do not read by path again.
 *
 * @throws `InstallError` (`integrity`) naming the file that failed, with no path.
 */
export async function loadEntry(storeDir: string, digest: string): Promise<LoadedEntry | null> {
  const dir = entryDir(storeDir, digest)
  if (!await exists(dir)) return null
  const fail = (detail: string): never => {
    throw new InstallError('integrity', { digest }, detail)
  }
  const manifestFile = join(dir, ENTRY_MANIFEST)
  if (!await exists(manifestFile)) return fail('the entry has no manifest')
  const raw = await readFile(manifestFile)
  if (raw.length > MAX_ENTRY_MANIFEST_BYTES) return fail('the manifest is too large')
  let manifest: EntryManifest
  try {
    manifest = JSON.parse(raw.toString('utf8')) as EntryManifest
  } catch {
    return fail('the manifest is not valid JSON')
  }
  if (manifest.storeVersion !== STORE_VERSION || manifest.digest !== digest || typeof manifest.files !== 'object' || manifest.files === null) return fail('the manifest is for another entry or layout')
  const expected = Object.keys(manifest.files).sort()
  const actual = (await listFiles(dir)).filter(path => path !== ENTRY_MANIFEST)
  if (expected.join('\n') !== actual.join('\n')) return fail('the files of the entry differ from its manifest')
  const files = new Map<string, Buffer>()
  let total = 0
  for (const path of expected) {
    const data = await readFile(join(dir, path))
    const listed = manifest.files[path]!
    total += data.length
    if (total > MAX_LOADED_BYTES) return fail('the entry is larger than the limit')
    if (data.length !== listed.size || sha256(data) !== listed.sha256) return fail(`${path} does not match its manifest`)
    files.set(path, data)
  }
  return { manifest, files }
}

/** Runs `run` holding the lock of one digest, so one install per digest runs at a time; the lock expires after the install timeout. */
async function withLock<T>(storeDir: string, digest: string, run: () => Promise<T>): Promise<T> {
  const { tmp } = layout(storeDir)
  await mkdir(tmp, { recursive: true, mode: 0o700 })
  const file = under(tmp, `lock-${digest}.json`)
  const owner = randomUUID()
  for (let attempt = 0; ; attempt++) {
    try {
      const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600)
      try {
        await handle.writeFile(JSON.stringify({ owner, pid: process.pid, expires: Date.now() + INSTALL_LEASE_MS }))
      } finally {
        await handle.close()
      }
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      let expires = 0
      try {
        expires = Number((JSON.parse(await readFile(file, 'utf8')) as { expires?: unknown }).expires)
      } catch {
        // An unreadable lock is a lock that was cut short: treat it as expired
      }
      if (attempt > 0 || expires > Date.now()) throw new InstallError('busy', { digest }, 'another install of this theme is running')
      await rm(file, { force: true })
    }
  }
  try {
    return await run()
  } finally {
    try {
      if ((JSON.parse(await readFile(file, 'utf8')) as { owner?: unknown }).owner === owner) await rm(file, { force: true })
    } catch {
      // The lease ran out and another install replaced or removed the lock: it is theirs now
    }
  }
}

async function writeFiles(dir: string, files: Map<string, Buffer>): Promise<void> {
  for (const [path, data] of files) {
    const file = resolve(dir, path)
    if (!file.startsWith(resolve(dir) + sep)) throw new InstallError('store', {}, 'a file would be written outside the entry')
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, data, { mode: 0o644, flag: 'wx' })
  }
}

async function makeReadable(dir: string): Promise<void> {
  await chmod(dir, 0o755)
  for (const entry of await readdir(dir, { withFileTypes: true })) if (entry.isDirectory()) await makeReadable(join(dir, entry.name))
}

/** Keeps the verified package (and its attestation bundle) under its digest, once; an existing one must be the same bytes. */
async function keepPackage(storeDir: string, packageDigest: string, tgz: Uint8Array, attestation?: Uint8Array): Promise<void> {
  const dir = packageDir(storeDir, packageDigest)
  if (`sha256:${sha256(tgz)}` !== packageDigest) throw new InstallError('store', { digest: packageDigest }, 'the package to keep is not the one pinned')
  const staging = await privateTemp(storeDir, 'package-')
  try {
    await writeFile(join(staging, PACKAGE_FILE), tgz, { mode: 0o644, flag: 'wx' })
    if (attestation) await writeFile(join(staging, ATTESTATION_FILE), attestation, { mode: 0o644, flag: 'wx' })
    await chmod(staging, 0o755)
    await mkdir(dirname(dir), { recursive: true })
    try {
      await rename(staging, dir)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOTEMPTY' && code !== 'EEXIST') throw error
    }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

/** The package kept for a digest and its attestation bundle, or `null` when the bytes kept do not hash to the digest. */
export async function readKeptPackage(storeDir: string, packageDigest: string): Promise<{ tgz: Buffer, attestation: Buffer | null } | null> {
  const dir = packageDir(storeDir, packageDigest)
  if (!await exists(join(dir, PACKAGE_FILE))) return null
  const tgz = await readFile(join(dir, PACKAGE_FILE))
  if (`sha256:${sha256(tgz)}` !== packageDigest) return null
  return { tgz, attestation: await exists(join(dir, ATTESTATION_FILE)) ? await readFile(join(dir, ATTESTATION_FILE)) : null }
}

/**
 * Writes a compiled entry atomically: the files go to a private staging folder in the store and are renamed into place, so an interrupted write leaves nothing a reader can see.
 *
 * @remarks
 * Holds the lock of the digest. An entry already there that verifies is kept and `created` is false; one that does not verify is
 * replaced. For a package, the verified `.tgz` and its attestation are kept first, under the package digest.
 *
 * @param extras - The package bytes (and bundle) to keep; absent for a folder.
 * @throws `InstallError` (`busy`) when another install of the digest holds the lock, (`store`) when a write fails.
 */
export async function writeEntry(storeDir: string, manifest: EntryManifest, files: Map<string, Buffer>, extras: { tgz?: Uint8Array, attestation?: Uint8Array } = {}): Promise<{ created: boolean }> {
  const target = entryDir(storeDir, manifest.digest)
  return withLock(storeDir, manifest.digest, async () => {
    if (extras.tgz) await keepPackage(storeDir, manifest.packageDigest, extras.tgz, extras.attestation)
    let present: LoadedEntry | null = null
    try {
      present = await loadEntry(storeDir, manifest.digest)
    } catch (error) {
      if (!(error instanceof InstallError) || error.rule !== 'integrity') throw error
    }
    if (present) return { created: false }
    const staging = await privateTemp(storeDir, 'entry-')
    try {
      await writeFiles(staging, files)
      await writeFile(join(staging, ENTRY_MANIFEST), JSON.stringify(manifest), { mode: 0o644, flag: 'wx' })
      await makeReadable(staging)
      await mkdir(dirname(target), { recursive: true })
      await rm(target, { recursive: true, force: true })
      await rename(staging, target)
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
    return { created: true }
  })
}

/**
 * Removes what an interrupted install left in `.tmp/`: staging folders and expired locks.
 *
 * @remarks
 * Run at boot (ADR 0009, section 2). A lock still within its lease is kept: another process may be installing.
 */
export async function cleanTemporary(storeDir: string): Promise<void> {
  const { tmp } = layout(storeDir)
  if (!await exists(tmp)) return
  for (const entry of await readdir(tmp, { withFileTypes: true })) {
    const path = join(tmp, entry.name)
    if (entry.isFile() && entry.name.startsWith('lock-')) {
      try {
        if (Number((JSON.parse(await readFile(path, 'utf8')) as { expires?: unknown }).expires) > Date.now()) continue
      } catch {
        // An unreadable lock was cut short: remove it
      }
    }
    await rm(path, { recursive: true, force: true })
  }
}

/**
 * Removes the entries compiled for other core builds, and the kept packages no remaining entry uses, except those of `keep`.
 *
 * @remarks
 * The cleanup command of ADR 0009 (open question 3). Entries of the current compile key are never removed, and neither is the
 * package of a pin in `keep` (the active, last good and locked themes). An entry whose manifest cannot be read is removed. Each entry
 * is removed under its own lock.
 *
 * @param currentKey - The compile key of this core build (`compileKey()`).
 * @returns The digests of the entries removed and of the packages removed.
 */
export async function pruneStore(storeDir: string, currentKey: string, keep: ReadonlySet<string>): Promise<{ entries: string[], packages: string[] }> {
  const { entries, packages } = layout(storeDir)
  const removed = { entries: [] as string[], packages: [] as string[] }
  const used = new Set(keep)
  for (const name of await exists(entries) ? await readdir(entries) : []) {
    if (!COMPILED_DIGEST.test(name)) continue
    let manifest: EntryManifest | null = null
    try {
      manifest = JSON.parse(await readFile(join(entries, name, ENTRY_MANIFEST), 'utf8')) as EntryManifest
    } catch {
      // An unreadable manifest means a broken entry: it is removed below
    }
    if (manifest !== null && manifest.compileKey === currentKey) {
      used.add(manifest.packageDigest)
      continue
    }
    await withLock(storeDir, name, () => rm(join(entries, name), { recursive: true, force: true }))
    removed.entries.push(name)
  }
  for (const name of await exists(packages) ? await readdir(packages) : []) {
    if (used.has(`sha256:${name}`)) continue
    await rm(join(packages, name), { recursive: true, force: true })
    removed.packages.push(`sha256:${name}`)
  }
  return removed
}
