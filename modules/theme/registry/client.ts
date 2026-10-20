import { CONTRACT_VERSION } from '../constants'
import { parseContractVersion } from '../version'
import { DEFAULT_REGISTRY, INDEX_MEDIA_TYPE, INDEX_REPOSITORY, INDEX_TAG, MAX_COMPRESSED_BYTES, MAX_INDEX_BYTES, PACKAGE_MEDIA_TYPE } from './constants'
import { RegistryError, withPin } from './error'
import { parseIndex } from './registry-index'
import type { RegistryIndex } from './registry-index'
import { createOciClient } from './oci'
import type { OciClientOptions, OciDescriptor } from './oci'
import { assertPin } from './pin'
import { compareVersions, highestSatisfying } from './semver'
import type { LockEntry, ThemePin } from './types'

/** A theme version the index offers, resolved to what a lock entry needs. */
export interface ResolvedTheme extends ThemePin, Pick<LockEntry, 'contract' | 'tier' | 'distribution' | 'code'> {
  /** The registry the entry was resolved against, as set. */
  registry: string
}

/** The registry behind one interface, so a server, the static builder and the CLI share it. */
export interface ThemeRegistry {
  /** The highest published version of `id` that satisfies `range` (default `*`) and this core's contract. */
  resolve: (id: string, range?: string) => Promise<ResolvedTheme>
  /** The versions of `id` newer than `current` that this core can install, highest first. */
  newer: (id: string, current: string) => Promise<string[]>
  /** The bytes of the package a pin names, at most 2 MiB, whose sha256 equals `pin.digest`. */
  fetch: (pin: ThemePin) => Promise<Buffer>
}

/** Options of `createRegistry`. */
export interface RegistryOptions extends Partial<Pick<OciClientOptions, 'fetch' | 'timeoutMs'>> {
  /** `host[:port]/path`; `DEFAULT_REGISTRY` when not given. */
  registry?: string
}

/** The theme `id` of the index; an id such as `constructor` is not found unless the index itself lists it. */
function themeOf(index: RegistryIndex, id: string): RegistryIndex['themes'][string] | undefined {
  return Object.hasOwn(index.themes, id) ? index.themes[id] : undefined
}

function singleLayer(manifest: { layers: OciDescriptor[] }, mediaType: string, what: string, pin: Partial<ThemePin>): OciDescriptor {
  const layer = manifest.layers[0]
  if (manifest.layers.length !== 1 || !layer || layer.mediaType !== mediaType) throw new RegistryError('registry', `${what} must hold one layer of ${mediaType}`, pin)
  return layer
}

/** Whether this core can run a package that declares `contract`: the same major and a minor it implements. */
function compatible(contract: string): boolean {
  const version = parseContractVersion(contract)
  return version !== null && version.major === CONTRACT_VERSION.major && version.minor <= CONTRACT_VERSION.minor
}

/**
 * Creates the registry client for `MICELIO_THEME_REGISTRY` (or the given address).
 *
 * @remarks
 * `resolve` reads the index, skips yanked versions, those marked incompatible and those whose contract this core cannot run, and
 * refuses a `licensed` theme (#320). `fetch` does not read the index: a lock keeps working for a version that was yanked later.
 * The index is read once per client. Verification of the index signature and of the provenance attestation is not here yet.
 *
 * @throws `RegistryError` (`registry`) when the registry address is invalid.
 */
export function createRegistry(options: RegistryOptions = {}): ThemeRegistry {
  const registry = options.registry ?? DEFAULT_REGISTRY
  const oci = createOciClient({ registry, ...(options.fetch ? { fetch: options.fetch } : {}), ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}) })
  let cached: Promise<RegistryIndex> | undefined

  async function loadIndex(): Promise<RegistryIndex> {
    const layer = singleLayer(await oci.manifest(INDEX_REPOSITORY, INDEX_TAG), INDEX_MEDIA_TYPE, 'the index', {})
    if (layer.size > MAX_INDEX_BYTES) throw new RegistryError('size', `the index declares ${layer.size} bytes; the limit is ${MAX_INDEX_BYTES}`)
    return parseIndex((await oci.blob(INDEX_REPOSITORY, layer.digest, MAX_INDEX_BYTES)).toString('utf8'))
  }

  /** The index, read once; a failed read is not kept, so the next call tries again. */
  async function index(): Promise<RegistryIndex> {
    cached ??= loadIndex()
    try {
      return await cached
    } catch (error) {
      cached = undefined
      throw error
    }
  }

  function assertName(id: string): void {
    assertPin({ id, version: '0.0.0', digest: `sha256:${'0'.repeat(64)}` })
    if (id === INDEX_REPOSITORY) throw new RegistryError('pin', `"${INDEX_REPOSITORY}" is the registry's index, not a theme id`)
  }

  return {
    async resolve(id, range = '*') {
      assertName(id)
      const theme = themeOf(await index(), id)
      if (!theme) throw new RegistryError('not-found', `the registry ${registry} has no theme "${id}"`, { id })
      const candidates = Object.entries(theme.versions).filter(([, entry]) => entry.status === 'published' && compatible(entry.contract))
      const version = highestSatisfying(candidates.map(([name]) => name), range)
      const entry = version === null ? undefined : theme.versions[version]
      if (version === null || !entry) {
        throw new RegistryError('not-found', `no published version of "${id}" satisfies ${range.slice(0, 40)} and contract ${CONTRACT_VERSION.major}.${CONTRACT_VERSION.minor}`, { id })
      }
      const pin = { id, version, digest: entry.digest }
      if (entry.distribution === 'licensed') throw new RegistryError('unsupported', 'is a licensed theme; licensed distribution is not supported yet', pin)
      return { ...pin, contract: entry.contract, tier: entry.tier, distribution: entry.distribution, code: entry.code, registry }
    },
    async newer(id, current) {
      assertName(id)
      const theme = themeOf(await index(), id)
      if (!theme) throw new RegistryError('not-found', `the registry ${registry} has no theme "${id}"`, { id })
      return Object.entries(theme.versions)
        .filter(([version, entry]) => entry.status === 'published' && entry.distribution === 'public' && compatible(entry.contract) && compareVersions(version, current) > 0)
        .map(([version]) => version)
        .sort((a, b) => compareVersions(b, a))
    },
    async fetch(pin) {
      assertName(pin.id)
      assertPin(pin)
      try {
        const layer = singleLayer(await oci.manifest(pin.id, pin.version), PACKAGE_MEDIA_TYPE, 'the package', pin)
        if (layer.digest !== pin.digest) throw new RegistryError('digest', `the registry's ${pin.version} is ${layer.digest}`)
        if (layer.size > MAX_COMPRESSED_BYTES) throw new RegistryError('size', `the package declares ${layer.size} bytes; the limit is ${MAX_COMPRESSED_BYTES}`)
        return await oci.blob(pin.id, pin.digest, MAX_COMPRESSED_BYTES)
      } catch (error) {
        throw withPin(error, pin)
      }
    },
  }
}
