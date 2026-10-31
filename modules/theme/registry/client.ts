import { createHash } from 'node:crypto'
import { CONTRACT_VERSION, THEME_VERSION } from '../constants'
import { parseContractVersion } from '../version'
import { signerOptions, verifyBundle } from './attestation'
import { ATTESTATION_TAG_SUFFIX, BUNDLE_MEDIA_TYPE, DEFAULT_REGISTRY, INDEX_MEDIA_TYPE, INDEX_REPOSITORY, INDEX_TAG, MAX_BUNDLE_BYTES, MAX_COMPRESSED_BYTES, MAX_INDEX_BYTES, PACKAGE_MEDIA_TYPE } from './constants'
import { RegistryError, safeText, withPin } from './error'
import { parseIndex } from './registry-index'
import { createOciClient } from './oci'
import type { OciClientOptions, OciDescriptor } from './oci'
import { assertPin } from './pin'
import { compareVersions, highestSatisfying, satisfies } from './semver'
import type { BundleVerifier, IndexVersion, RegistryIndex, SignerIdentity, ThemePin, ThemeRegistry } from './types'

/** Options of `createRegistry`. */
export interface RegistryOptions extends Partial<Pick<OciClientOptions, 'fetch' | 'timeoutMs'>> {
  /** `host[:port]/path`; `DEFAULT_REGISTRY` when not given. */
  registry?: string
  /**
   * The signer the registry's index and packages must come from (`identityFor`). `null` means none is known: nothing is read from
   * the registry, and the error says to set `MICELIO_THEME_REGISTRY_IDENTITY`.
   */
  identity: SignerIdentity | null
  /** Verifies a bundle; `verifyBundle` (offline Sigstore verification) when not given. Tests pass a stand-in. */
  verifier?: BundleVerifier
  /**
   * The version of the core that runs this client, to tell which `incompatible` versions it can still install (#314). When not
   * given, every version the index marks `incompatible` is skipped.
   */
  core?: string
}

/** The theme `id` of the index; an id such as `constructor` is not found unless the index itself lists it. */
function themeOf(index: RegistryIndex, id: string): RegistryIndex['themes'][string] | undefined {
  return Object.hasOwn(index.themes, id) ? index.themes[id] : undefined
}

function versionOf(index: RegistryIndex, pin: ThemePin): RegistryIndex['themes'][string]['versions'][string] | undefined {
  const versions = themeOf(index, pin.id)?.versions
  return versions && Object.hasOwn(versions, pin.version) ? versions[pin.version] : undefined
}

function singleLayer(manifest: { layers: OciDescriptor[] }, mediaType: string, what: string, pin: Partial<ThemePin>): OciDescriptor {
  const layer = manifest.layers[0]
  if (manifest.layers.length !== 1 || !layer || layer.mediaType !== mediaType) throw new RegistryError('registry', `${what} must hold one layer of ${mediaType}`, pin)
  return layer
}

/** Whether the index marks `entry` incompatible with `core`: from the version it names on, or always when it names none or `core` is unknown. */
function incompatibleWith(entry: IndexVersion, core: string | undefined): boolean {
  if (entry.status !== 'incompatible') return false
  if (!entry.incompatible || core === undefined || !THEME_VERSION.test(core)) return true
  return compareVersions(core, entry.incompatible.core) >= 0
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
 * The index is read once per client and its signature verified first: nothing in an unverified index is used. Every package is
 * checked against the index and against its provenance attestation (ADR 0009, section 3); a failed check is a refused install.
 *
 * @throws `RegistryError` (`registry`) when the registry address is invalid.
 */
export function createRegistry(options: RegistryOptions): ThemeRegistry {
  const registry = options.registry ?? DEFAULT_REGISTRY
  const core = options.core
  /** Whether a version may be resolved for a new range: published, or marked incompatible only for cores newer than this one. */
  const offered = (entry: IndexVersion): boolean => entry.status === 'published' || (entry.status === 'incompatible' && !incompatibleWith(entry, core))
  const verifier = options.verifier ?? verifyBundle
  const oci = createOciClient({ registry, ...(options.fetch ? { fetch: options.fetch } : {}), ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}) })
  let cached: Promise<RegistryIndex> | undefined

  function signer(): SignerIdentity {
    if (!options.identity) throw new RegistryError('signer', `no signer identity is known for ${registry}: set MICELIO_THEME_REGISTRY_IDENTITY (issuer=…,package=…[,index=…]) or use the default registry`)
    return options.identity
  }

  /** The Sigstore bundle at `<name>:<tag>`, which must be one layer of the bundle media type. */
  async function readBundle(name: string, tag: string, pin: Partial<ThemePin>): Promise<Buffer> {
    const layer = singleLayer(await oci.manifest(name, tag), BUNDLE_MEDIA_TYPE, 'the attestation', pin)
    if (layer.size > MAX_BUNDLE_BYTES) throw new RegistryError('size', `the attestation declares ${layer.size} bytes; the limit is ${MAX_BUNDLE_BYTES}`, pin)
    return oci.blob(name, layer.digest, MAX_BUNDLE_BYTES)
  }

  async function loadIndex(): Promise<RegistryIndex> {
    const identity = signer()
    const layer = singleLayer(await oci.manifest(INDEX_REPOSITORY, INDEX_TAG), INDEX_MEDIA_TYPE, 'the index', {})
    if (layer.size > MAX_INDEX_BYTES) throw new RegistryError('size', `the index declares ${layer.size} bytes; the limit is ${MAX_INDEX_BYTES}`)
    const body = await oci.blob(INDEX_REPOSITORY, layer.digest, MAX_INDEX_BYTES)
    const bundle = await readBundle(INDEX_REPOSITORY, `${INDEX_TAG}${ATTESTATION_TAG_SUFFIX}`, {})
    try {
      verifier(bundle, { subject: { algorithm: 'sha256', hex: createHash('sha256').update(body).digest('hex') }, ...signerOptions(identity, 'index') })
    } catch (error) {
      throw error instanceof RegistryError && error.failure === 'attestation' ? new RegistryError('signature', `the index signature does not verify: ${error.detail}`, {}, { cause: error }) : error
    }
    return parseIndex(body.toString('utf8'))
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

  /** Why the versions of `range` that the index marks incompatible with this core are not offered, newer than `chosen` when there is one. */
  function skippedNotes(versions: Record<string, IndexVersion>, range: string, chosen: string | null | undefined): string[] {
    return Object.entries(versions)
      .filter(([version, entry]) => incompatibleWith(entry, core) && satisfies(version, range) && (chosen === undefined || chosen === null || compareVersions(version, chosen) > 0))
      .sort(([a], [b]) => compareVersions(b, a))
      .map(([version, entry]) => `${version} is marked incompatible with ${entry.incompatible ? `micelio ${safeText(entry.incompatible.core)} and later: ${safeText(entry.incompatible.reason)}` : 'this core'}`)
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
      const candidates = Object.entries(theme.versions).filter(([, entry]) => offered(entry) && compatible(entry.contract))
      const version = highestSatisfying(candidates.map(([name]) => name), range)
      const entry = version === null ? undefined : theme.versions[version]
      if (version === null || !entry) {
        const left = skippedNotes(theme.versions, range, undefined)
        throw new RegistryError('not-found', `no published version of "${id}" satisfies ${range.slice(0, 40)} and contract ${CONTRACT_VERSION.major}.${CONTRACT_VERSION.minor}${left.length > 0 ? `; ${left.join('; ')}` : ''}`, { id })
      }
      const pin = { id, version, digest: entry.digest }
      if (entry.distribution === 'licensed') throw new RegistryError('unsupported', 'is a licensed theme; licensed distribution is not supported yet', pin)
      return { ...pin, contract: entry.contract, tier: entry.tier, distribution: entry.distribution, code: entry.code, registry, skipped: skippedNotes(theme.versions, range, version) }
    },
    async newer(id, current) {
      assertName(id)
      const theme = themeOf(await index(), id)
      if (!theme) throw new RegistryError('not-found', `the registry ${registry} has no theme "${id}"`, { id })
      return Object.entries(theme.versions)
        .filter(([version, entry]) => offered(entry) && entry.distribution === 'public' && compatible(entry.contract) && compareVersions(version, current) > 0)
        .map(([version]) => version)
        .sort((a, b) => compareVersions(b, a))
    },
    async listed(pin) {
      assertName(pin.id)
      assertPin(pin)
      try {
        signer()
        const found = versionOf(await index(), pin)
        return found?.digest === pin.digest ? found : undefined
      } catch (error) {
        throw withPin(error, pin)
      }
    },
    async fetch(pin, fetchOptions = {}) {
      assertName(pin.id)
      assertPin(pin)
      try {
        const identity = signer()
        const listed = versionOf(await index(), pin)
        if (listed?.digest !== pin.digest) throw new RegistryError('listing', `the index does not list ${pin.id}@${pin.version} with this digest`)
        const allowed = offered(listed) || (fetchOptions.locked === true && (listed.status === 'yanked' || listed.status === 'incompatible'))
        if (!allowed) throw new RegistryError('listing', `the index marks this version ${listed.status}`)
        const layer = singleLayer(await oci.manifest(pin.id, pin.version), PACKAGE_MEDIA_TYPE, 'the package', pin)
        if (layer.digest !== pin.digest) throw new RegistryError('digest', `the registry's ${pin.version} is ${layer.digest}`)
        if (layer.size > MAX_COMPRESSED_BYTES) throw new RegistryError('size', `the package declares ${layer.size} bytes; the limit is ${MAX_COMPRESSED_BYTES}`)
        const data = await oci.blob(pin.id, pin.digest, MAX_COMPRESSED_BYTES)
        const bundle = await readBundle(pin.id, `${pin.version}${ATTESTATION_TAG_SUFFIX}`, pin)
        verifier(bundle, { subject: { algorithm: 'sha256', hex: pin.digest.slice('sha256:'.length) }, ...signerOptions(identity, 'packages') })
        return { data, bundle }
      } catch (error) {
        throw withPin(error, pin)
      }
    },
    verify(pin, bundle) {
      assertName(pin.id)
      assertPin(pin)
      try {
        verifier(bundle, { subject: { algorithm: 'sha256', hex: pin.digest.slice('sha256:'.length) }, ...signerOptions(signer(), 'packages') })
      } catch (error) {
        throw withPin(error, pin)
      }
    },
  }
}
