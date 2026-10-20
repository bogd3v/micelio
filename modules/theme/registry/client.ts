import { createHash } from 'node:crypto'
import { CONTRACT_VERSION } from '../constants'
import { parseContractVersion } from '../version'
import { signerOptions, verifyBundle } from './attestation'
import type { BundleVerifier } from './attestation'
import { ATTESTATION_TAG_SUFFIX, BUNDLE_MEDIA_TYPE, DEFAULT_REGISTRY, INDEX_MEDIA_TYPE, INDEX_REPOSITORY, INDEX_TAG, MAX_BUNDLE_BYTES, MAX_COMPRESSED_BYTES, MAX_INDEX_BYTES, PACKAGE_MEDIA_TYPE } from './constants'
import { RegistryError, withPin } from './error'
import { parseIndex } from './registry-index'
import type { RegistryIndex } from './registry-index'
import { createOciClient } from './oci'
import type { OciClientOptions, OciDescriptor } from './oci'
import { assertPin } from './pin'
import { compareVersions, highestSatisfying } from './semver'
import type { LockEntry, SignerIdentity, ThemePin } from './types'

/** A theme version the index offers, resolved to what a lock entry needs. */
export interface ResolvedTheme extends ThemePin, Pick<LockEntry, 'contract' | 'tier' | 'distribution' | 'code'> {
  /** The registry the entry was resolved against, as set. */
  registry: string
}

/** A package the registry served and whose attestation verified. */
export interface FetchedPackage {
  /** The `.tgz`, at most 2 MiB, whose sha256 equals the pin's digest. */
  data: Buffer
  /** The Sigstore bundle that vouches for it, to keep next to the package. */
  bundle: Buffer
}

/** The registry behind one interface, so a server, the static builder and the CLI share it. */
export interface ThemeRegistry {
  /** The highest published version of `id` that satisfies `range` (default `*`) and this core's contract. */
  resolve: (id: string, range?: string) => Promise<ResolvedTheme>
  /** The versions of `id` newer than `current` that this core can install, highest first. */
  newer: (id: string, current: string) => Promise<string[]>
  /**
   * The package a pin names with its attestation, after the index lists it with the same digest and status `published`, or
   * `yanked` or `incompatible` when `locked` (the digest is this site's own pin), and the attestation verifies.
   */
  fetch: (pin: ThemePin, options?: { locked?: boolean }) => Promise<FetchedPackage>
  /** Verifies, with no network, the attestation bundle of a package that was kept (for example in the cache). */
  verify: (pin: ThemePin, bundle: Uint8Array) => void
}

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
 * The index is read once per client and its signature verified first: nothing in an unverified index is used. Every package is
 * checked against the index and against its provenance attestation (ADR 0009, section 3); a failed check is a refused install.
 *
 * @throws `RegistryError` (`registry`) when the registry address is invalid.
 */
export function createRegistry(options: RegistryOptions): ThemeRegistry {
  const registry = options.registry ?? DEFAULT_REGISTRY
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
    async fetch(pin, fetchOptions = {}) {
      assertName(pin.id)
      assertPin(pin)
      try {
        const identity = signer()
        const listed = (await index()).themes[pin.id]?.versions[pin.version]
        if (listed?.digest !== pin.digest) throw new RegistryError('listing', `the index does not list ${pin.id}@${pin.version} with this digest`)
        const allowed = listed.status === 'published' || (fetchOptions.locked === true && (listed.status === 'yanked' || listed.status === 'incompatible'))
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
