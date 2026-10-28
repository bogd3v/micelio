import { createHash } from 'node:crypto'
import { signerOptions, verifyBundle } from '../registry/attestation'
import { ATTESTATION_TAG_SUFFIX, BUNDLE_MEDIA_TYPE, INDEX_MEDIA_TYPE, INDEX_REPOSITORY, INDEX_TAG, MAX_BUNDLE_BYTES, MAX_COMPRESSED_BYTES, MAX_INDEX_BYTES, PACKAGE_MEDIA_TYPE, THEME_DIGEST } from '../registry/constants'
import { RegistryError } from '../registry/error'
import { createOciClient } from '../registry/oci'
import type { OciClient } from '../registry/oci'
import { parseIndex } from '../registry/registry-index'
import type { BundleVerifier, RegistryIndex, SignerIdentity } from '../registry/types'
import { entryFromPackage } from './entry'
import { PublishError } from './error'
import { addVersion, EMPTY_INDEX, serializeIndex, successorProblems, yankVersion } from './index-edit'

// The signing workflow's side of an index change (ADR 0009, section 3): it reads the index it signed last, applies one change, checks
// the result with its own rules and returns the text to sign. It trusts nothing the publish workflow says about a package: the entry
// is derived from the package in the registry, whose attestation it verifies like a client does.

/** One change to the index. */
export type IndexChange
  = | { action: 'add', id: string, version: string, digest: string, reportDigest?: string }
    | { action: 'yank', id: string, version: string, reason: string, at: Date }

/** Options of `nextIndex`. */
export interface NextIndexOptions {
  /** `host[:port]/path` of the registry. */
  registry: string
  /** Who signs packages and the index in that registry. */
  identity: SignerIdentity
  change: IndexChange
  /** The `fetch` to use; tests pass their own. */
  fetch?: typeof fetch
  /** Verifies a bundle; `verifyBundle` when not given. Tests pass a stand-in. */
  verifier?: BundleVerifier
}

/** The index to sign. */
export interface NextIndex {
  /** The text of the new index, to push as the layer of `index:v1` and to sign. */
  document: string
  /** `sha256:` digest of `document`. */
  digest: string
  /** `sha256:` digest of the layer of the index this was made from; `null` when there was none. Pushing is refused if the registry's changed. */
  base: string | null
}

async function bundleOf(oci: OciClient, name: string, tag: string): Promise<Buffer> {
  const manifest = await oci.manifest(name, `${tag}${ATTESTATION_TAG_SUFFIX}`)
  const layer = manifest.layers[0]
  if (manifest.layers.length !== 1 || layer?.mediaType !== BUNDLE_MEDIA_TYPE) throw new PublishError(`the attestation of ${name}:${tag} is not one Sigstore bundle`)
  return oci.blob(name, layer.digest, MAX_BUNDLE_BYTES)
}

/** The index the registry holds, after its signature verifies against the index signer; `null` when there is no index yet. */
async function currentIndex(oci: OciClient, identity: SignerIdentity, verifier: BundleVerifier): Promise<{ index: RegistryIndex, base: string } | null> {
  let manifest
  try {
    manifest = await oci.manifest(INDEX_REPOSITORY, INDEX_TAG)
  } catch (error) {
    if (error instanceof RegistryError && error.failure === 'not-found') return null
    throw error
  }
  const layer = manifest.layers[0]
  if (manifest.layers.length !== 1 || layer?.mediaType !== INDEX_MEDIA_TYPE) throw new PublishError('the index is not one layer of the index media type')
  const body = await oci.blob(INDEX_REPOSITORY, layer.digest, MAX_INDEX_BYTES)
  verifier(await bundleOf(oci, INDEX_REPOSITORY, INDEX_TAG), { subject: { algorithm: 'sha256', hex: layer.digest.slice('sha256:'.length) }, ...signerOptions(identity, 'index') })
  return { index: parseIndex(body.toString('utf8')), base: layer.digest }
}

/** The package the registry holds for `id:version`, after its attestation verifies against the package signer. */
async function publishedPackage(oci: OciClient, identity: SignerIdentity, verifier: BundleVerifier, id: string, version: string, digest: string): Promise<Buffer> {
  const manifest = await oci.manifest(id, version)
  const layer = manifest.layers[0]
  if (manifest.layers.length !== 1 || layer?.mediaType !== PACKAGE_MEDIA_TYPE) throw new PublishError(`${id}:${version} is not one package layer`)
  if (layer.digest !== digest) throw new PublishError(`${id}:${version} holds ${layer.digest}, not ${digest}`)
  const data = await oci.blob(id, digest, MAX_COMPRESSED_BYTES)
  verifier(await bundleOf(oci, id, version), { subject: { algorithm: 'sha256', hex: digest.slice('sha256:'.length) }, ...signerOptions(identity, 'packages') })
  return data
}

/**
 * Checks that `bundle` is the attestation of `digest` made by the signer the registry pins for `kind` (the packages' signer or the index's).
 *
 * @remarks
 * The jobs that sign live in `bogd3v/micelio-themes` (ADR 0009, amendment of 2026-10-28). This runs before anything is pushed, so a
 * signature made under any other workflow file is refused by the same check a client applies, not found out at install time.
 *
 * @throws `RegistryError` (`attestation`, `trust-root`) when the bundle does not verify.
 */
export function verifySigned(bundle: Uint8Array, kind: 'packages' | 'index', digest: string, identity: SignerIdentity, verifier: BundleVerifier = verifyBundle): void {
  verifier(bundle, { subject: { algorithm: 'sha256', hex: digest.slice('sha256:'.length) }, ...signerOptions(identity, kind) })
}

/**
 * Decides whether a new index may be written: `write` when the registry holds the one it was made from, `written` when it already holds this one.
 *
 * @remarks
 * The registry has no compare-and-swap, so this runs right before the write: the concurrency group of the caller serializes runs and this
 * catches a write that came from anywhere else while the index was being signed. `written` is the half-written state: the index landed but
 * its signature did not, so a repeat of the write pushes the signature only. Any other index is refused.
 *
 * @param options - `base` is the `base` of `NextIndex`: `null` when there was no index. `digest` is the digest of the index to write.
 * @throws `PublishError` when another index landed, or one appeared where there was none; `RegistryError` when the registry cannot be read.
 */
export async function assertBase(options: { registry: string, base: string | null, digest?: string, fetch?: typeof fetch }): Promise<'write' | 'written'> {
  const oci = createOciClient({ registry: options.registry, ...(options.fetch ? { fetch: options.fetch } : {}) })
  let held: string | null
  try {
    held = (await oci.manifest(INDEX_REPOSITORY, INDEX_TAG)).layers[0]?.digest ?? null
  } catch (error) {
    if (!(error instanceof RegistryError) || error.failure !== 'not-found') throw error
    held = null
  }
  if (options.digest !== undefined && held === options.digest) return 'written'
  if (held !== options.base) throw new PublishError('The index changed while it was being signed; run again')
  return 'write'
}

/** Options of `assertListed`. */
export interface AssertListedOptions {
  /** `host[:port]/path` of the registry. */
  registry: string
  /** Who signs packages and the index in that registry. */
  identity: SignerIdentity
  id: string
  version: string
  /** `sha256:` digest of the package the run pushed. */
  digest: string
  /** `sha256:` digest of the admission report the run pushed; named in the re-run when given. */
  reportDigest?: string
  /** The `fetch` to use; tests pass their own. */
  fetch?: typeof fetch
  /** Verifies a bundle; `verifyBundle` when not given. Tests pass a stand-in. */
  verifier?: BundleVerifier
}

/**
 * Checks that the signed index lists a package the publish run pushed, and says how to list it when it does not.
 *
 * @remarks
 * GitHub keeps one running and one pending run per concurrency group and cancels an older pending run for a newer one, so with the
 * approval of `theme-index` held open a request to the index can be cancelled after its package was pushed and attested. Nothing
 * lists that version. This runs at the end of the publish run and turns the silent loss into a failure with the exact re-run.
 * A yanked version counts as listed: it was listed.
 *
 * @throws `PublishError` when the version is not listed, or is listed with another package digest; `RegistryError` when the index does not verify.
 */
export async function assertListed(options: AssertListedOptions): Promise<void> {
  const oci = createOciClient({ registry: options.registry, ...(options.fetch ? { fetch: options.fetch } : {}) })
  const current = await currentIndex(oci, options.identity, options.verifier ?? verifyBundle)
  const theme = current && Object.hasOwn(current.index.themes, options.id) ? current.index.themes[options.id] : undefined
  const listed = theme && Object.hasOwn(theme.versions, options.version) ? theme.versions[options.version] : undefined
  const name = `${options.id}@${options.version}`
  if (listed && listed.digest !== options.digest) throw new PublishError(`${name} is listed with the package ${listed.digest}, not the ${options.digest} this run pushed`)
  if (listed) return
  const report = options.reportDigest ? `, report-digest ${options.reportDigest}` : ''
  throw new PublishError(`${name} is pushed and attested but not in the index: its request to the index was cancelled or failed. Run "Sign index" (sign-index.yml) with action add, theme ${options.id}, version ${options.version}, digest ${options.digest}${report}`)
}

/**
 * The index with one change applied, ready to sign.
 *
 * @remarks
 * `add` reads the package from the registry, verifies its attestation against the publish signer and lists what the package says it
 * is (never what the caller says), then lists it. `yank` marks a published version. Both refuse a change the index rules forbid and
 * check the result against the previous index with `successorProblems`.
 *
 * @throws `PublishError` when the change is refused, `RegistryError` when the registry or a signature is not what is expected.
 */
export async function nextIndex(options: NextIndexOptions): Promise<NextIndex> {
  const verifier = options.verifier ?? verifyBundle
  const oci = createOciClient({ registry: options.registry, ...(options.fetch ? { fetch: options.fetch } : {}) })
  const current = await currentIndex(oci, options.identity, verifier)
  const previous = current?.index ?? EMPTY_INDEX
  const { change } = options
  let next: RegistryIndex
  if (change.action === 'add') {
    if (!THEME_DIGEST.test(change.digest)) throw new PublishError('the package digest is not a sha256 digest')
    const data = await publishedPackage(oci, options.identity, verifier, change.id, change.version, change.digest)
    const listed = entryFromPackage(data, change.digest, change.reportDigest)
    if (listed.id !== change.id || listed.version !== change.version) throw new PublishError(`the package is ${listed.id}@${listed.version}, not ${change.id}@${change.version}`)
    next = addVersion(previous, change.id, change.version, listed.entry)
  } else {
    next = yankVersion(previous, change.id, change.version, change.reason, change.at)
  }
  const problems = successorProblems(previous, next)
  if (problems.length > 0) throw new PublishError(`the new index is not a valid successor: ${problems.join('; ')}`)
  const document = serializeIndex(next)
  return { document, digest: `sha256:${createHash('sha256').update(document).digest('hex')}`, base: current?.base ?? null }
}
