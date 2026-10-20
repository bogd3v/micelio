import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cacheDir, cacheGet, cacheGetBundle, cachePut, cachePutBundle } from './cache'
import { createRegistry } from './client'
import type { ThemeRegistry } from './client'
import { DEFAULT_REGISTRY, LOCK_FILE, MAX_COMPRESSED_BYTES, PULLED_THEMES_DIR } from './constants'
import { RegistryError } from './error'
import { identityFor } from './identity'
import { formatLock, readLock, writeLock } from './lock'
import { checkIdentity, pruneThemes, writeTheme } from './materialize'
import { assertPin } from './pin'
import { unpackTheme } from './unpack'
import type { LockEntry, ThemeLock, ThemePin, UnpackedTheme } from './types'

// What `theme:add`, `theme:pull` and `theme:outdated` do, apart from reading the command line (#310).

/** What the commands need from their surroundings; `createContext` fills it from the environment. */
export interface RegistryContext {
  /** The repository root: where `themes.lock.json` is and `.micelio/themes/` is written. */
  root: string
  /** The registry a new entry is resolved against (`MICELIO_THEME_REGISTRY`). */
  registry: string
  /** The registry client for an address; an existing lock entry is pulled from the registry it was resolved against. */
  registryFor: (registry: string) => ThemeRegistry
  /** The directory of cached packages. */
  cacheDir: string
  /** Prints one line of progress. */
  log: (line: string) => void
}

/** A theme `theme:pull` installed. */
export interface PulledTheme extends ThemePin {
  /** Where it was written. */
  dir: string
  /** Whether the bytes came from the cache. */
  cached: boolean
}

/** Builds the context from the environment: `MICELIO_THEME_REGISTRY` and the cache directory. */
export function createContext(root: string, env: NodeJS.ProcessEnv = process.env, log: (line: string) => void = line => process.stdout.write(`${line}\n`)): RegistryContext {
  const clients = new Map<string, ThemeRegistry>()
  // one client per registry, so the index is read once for the whole lock
  const registryFor = (registry: string): ThemeRegistry => {
    const known = clients.get(registry) ?? createRegistry({ registry, identity: identityFor(registry, env) })
    clients.set(registry, known)
    return known
  }
  return { root, registry: env.MICELIO_THEME_REGISTRY || DEFAULT_REGISTRY, registryFor, cacheDir: cacheDir(env), log }
}

/**
 * The package a pin names: from the cache when its kept attestation still verifies offline, else from the registry (which checks
 * the index and the attestation), and then kept in the cache with its bundle.
 */
async function obtain(context: RegistryContext, registry: ThemeRegistry, pin: ThemePin, locked: boolean): Promise<{ data: Buffer, cached: boolean }> {
  const kept = cacheGet(pin.digest, context.cacheDir)
  const bundle = cacheGetBundle(pin.digest, context.cacheDir)
  if (kept && bundle) {
    try {
      registry.verify(pin, bundle)
      return { data: kept, cached: true }
    } catch {
      // the kept attestation does not verify (or no signer is known): the registry is asked, and it either proves the package or refuses
    }
  }
  const fetched = await registry.fetch(pin, { locked })
  cachePut(pin.digest, fetched.data, context.cacheDir)
  cachePutBundle(pin.digest, fetched.bundle, context.cacheDir)
  return { data: fetched.data, cached: false }
}

/** The package of a theme added from a file: it lives only in the cache, and there is no registry to ask. */
function keptFile(context: RegistryContext, pin: ThemePin): { data: Buffer, cached: boolean } {
  const data = cacheGet(pin.digest, context.cacheDir)
  if (!data) throw new RegistryError('not-found', `was added from a file and the package is not in the cache (${context.cacheDir}); run npm run theme:add with the file again`, pin)
  return { data, cached: true }
}

function sha256(data: Uint8Array): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`
}

/** Unpacks bytes against the pin, checks they are the theme the pin names, and returns what a lock entry records of them. */
function inspect(pin: ThemePin, data: Uint8Array): { unpacked: UnpackedTheme, contract: string } {
  try {
    const unpacked = unpackTheme(data, { digest: pin.digest })
    return { unpacked, ...checkIdentity(pin, unpacked) }
  } catch (error) {
    if (error instanceof RegistryError) throw error
    throw new RegistryError('digest', (error as Error).message, pin, { cause: error })
  }
}

/**
 * Adds a theme to the lock: `<id>[@range]` resolved against the index, or the path of a local `.tgz`.
 *
 * @remarks
 * The package is downloaded, verified against its digest and unpacked in memory before the lock is written, so a lock never
 * names a package that was not checked. It is also put in the cache. Nothing is installed: `theme:pull` does that.
 *
 * @returns The id and the entry written.
 * @throws `RegistryError` for the first thing that fails: the spec, the registry, the digest, the package or its contract.
 */
export async function addTheme(context: RegistryContext, spec: string): Promise<{ id: string, entry: LockEntry }> {
  const lock = readLock(context.root)
  let id: string
  let entry: LockEntry
  if (spec.endsWith('.tgz')) {
    const file = resolve(context.root, spec)
    if (statSync(file).size > MAX_COMPRESSED_BYTES) throw new RegistryError('size', `${spec} is larger than ${MAX_COMPRESSED_BYTES} bytes`)
    const data = readFileSync(file)
    const digest = sha256(data)
    const unpacked = unpackTheme(data, { digest })
    let manifest: Record<string, unknown>
    try {
      manifest = JSON.parse(new TextDecoder().decode(unpacked.files.get('theme.json'))) as Record<string, unknown>
    } catch (error) {
      throw new RegistryError('identity', 'theme.json is not valid JSON', {}, { cause: error })
    }
    const pin = assertPin({ id: manifest.id, version: manifest.version, digest })
    const { contract } = checkIdentity(pin, unpacked)
    cachePut(digest, data, context.cacheDir)
    id = pin.id
    entry = { version: pin.version, digest, contract, tier: 'local', distribution: 'file', registry: null, code: unpacked.code }
  } else {
    const [name = '', range, extra] = spec.split('@') as [string, string | undefined, string | undefined]
    if (extra !== undefined) throw new RegistryError('pin', 'a theme is <id> or <id>@<range>, with one @')
    const registry = context.registryFor(context.registry)
    const resolved = await registry.resolve(name, range)
    const { data } = await obtain(context, registry, resolved, false)
    const { unpacked, contract } = inspect(resolved, data)
    if (unpacked.code !== resolved.code) throw new RegistryError('lock', `the index says code is ${resolved.code} but the package makes it ${unpacked.code}`, resolved)
    id = resolved.id
    entry = { version: resolved.version, digest: resolved.digest, contract, tier: resolved.tier, distribution: 'public', registry: resolved.registry, code: unpacked.code }
  }
  writeLock(context.root, { ...lock, [id]: entry })
  context.log(`${id}@${entry.version} ${entry.digest} added to ${LOCK_FILE}${entry.code ? ' (has code: only an image built with it can run its slots)' : ''}`)
  return { id, entry }
}

/**
 * Installs every theme of the lock into `.micelio/themes/<id>/`, from the cache when the package is there, else from its registry.
 *
 * @remarks
 * Each package is verified against the digest of the lock, and a registry package against its attestation (offline from the cache, with the index online), before anything is written. With `frozen` the lock must exist, be in
 * the form `theme:add` writes, and agree with every package it names; without it, a lock entry whose `contract` or `code` differs from
 * the verified package is corrected (the digest is the trust anchor, the rest is a record). Nothing from a package is executed.
 *
 * @throws `RegistryError` naming the theme, version and digest for the first failure; nothing later in the lock is pulled.
 */
export async function pullThemes(context: RegistryContext, options: { frozen?: boolean } = {}): Promise<PulledTheme[]> {
  const file = join(context.root, LOCK_FILE)
  if (options.frozen) {
    if (!existsSync(file)) throw new RegistryError('lock', `--frozen needs ${LOCK_FILE}, which does not exist (npm run theme:add creates it)`)
    const lock = readLock(context.root)
    if (readFileSync(file, 'utf8') !== formatLock(lock)) throw new RegistryError('lock', `--frozen: ${LOCK_FILE} is not in the form theme:add writes; run npm run theme:pull to rewrite it`)
  }
  const lock = readLock(context.root)
  const corrected: ThemeLock = { ...lock }
  const pulled: PulledTheme[] = []
  for (const [id, entry] of Object.entries(lock)) {
    const pin = assertPin({ id, version: entry.version, digest: entry.digest })
    if (entry.distribution === 'licensed') throw new RegistryError('unsupported', 'is a licensed theme; licensed distribution is not supported yet', pin)
    const { data, cached } = entry.distribution === 'file' || entry.registry === null
      ? keptFile(context, pin)
      : await obtain(context, context.registryFor(entry.registry), pin, true)
    const { unpacked, contract } = inspect(pin, data)
    if (contract !== entry.contract || unpacked.code !== entry.code) {
      if (options.frozen) throw new RegistryError('lock', `${LOCK_FILE} says contract ${entry.contract} and code ${entry.code}; the package says ${contract} and ${unpacked.code}`, pin)
      corrected[id] = { ...entry, contract, code: unpacked.code }
    }
    const dir = writeTheme(join(context.root, PULLED_THEMES_DIR), id, unpacked)
    context.log(`${id}@${entry.version} ${entry.digest}${cached ? ' (cache)' : ''} -> ${PULLED_THEMES_DIR}/${id}`)
    pulled.push({ ...pin, dir, cached })
  }
  pruneThemes(join(context.root, PULLED_THEMES_DIR), new Set(Object.keys(lock)))
  if (!options.frozen && formatLock(corrected) !== formatLock(lock)) writeLock(context.root, corrected)
  return pulled
}

/**
 * Lists, for every registry theme of the lock, the newer versions this core can install.
 *
 * @throws `RegistryError` when a registry cannot be read.
 */
export async function outdatedThemes(context: RegistryContext): Promise<Array<{ id: string, current: string, newer: string[] }>> {
  const rows: Array<{ id: string, current: string, newer: string[] }> = []
  for (const [id, entry] of Object.entries(readLock(context.root))) {
    if (entry.distribution !== 'public' || entry.registry === null) continue
    const newer = await context.registryFor(entry.registry).newer(id, entry.version)
    if (newer.length > 0) rows.push({ id, current: entry.version, newer })
  }
  return rows
}
