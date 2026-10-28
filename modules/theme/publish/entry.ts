import { THEME_ID, THEME_VERSION } from '../constants'
import { THEME_JSON } from '../registry/constants'
import type { IndexVersion } from '../registry/types'
import { unpackTheme } from '../registry/unpack'
import { formatContractVersion, parseContractVersion } from '../version'
import { PUBLISH_TIER } from './constants'
import { PublishError } from './error'

/** A package read for the index: who it is and the entry that lists it. */
export interface PublishedPackage {
  id: string
  version: string
  entry: IndexVersion
}

/**
 * The index entry of a package, derived from the package itself and not from anything the caller says about it.
 *
 * @remarks
 * The bytes go through the same safe unpack a client uses, against `digest`. `code` is decided from the files, as the server decides
 * it (ADR 0009, section 4); id, version, license and contract come from `theme.json`. The tier is the one this workflow publishes.
 *
 * @param reportDigest - The `sha256:` digest of the admission report attached to the package, when it has one.
 * @throws `PublishError` when the package does not unpack, or its `theme.json` lacks a field the index needs.
 */
export function entryFromPackage(data: Uint8Array, digest: string, reportDigest?: string): PublishedPackage {
  let unpacked
  try {
    unpacked = unpackTheme(data, { digest })
  } catch (error) {
    throw new PublishError(`the package does not unpack: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
  const raw: unknown = JSON.parse(new TextDecoder().decode(unpacked.files.get(THEME_JSON)))
  const manifest = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const { id, version, license } = manifest
  const contract = parseContractVersion(manifest.contract)
  if (typeof id !== 'string' || !THEME_ID.test(id)) throw new PublishError('theme.json has no valid "id"')
  if (typeof version !== 'string' || !THEME_VERSION.test(version)) throw new PublishError('theme.json has no valid semver "version"')
  if (typeof license !== 'string' || license === '' || license.length > 128) throw new PublishError('theme.json has no "license"')
  if (!contract) throw new PublishError('theme.json declares no contract')
  const entry: IndexVersion = {
    digest,
    contract: formatContractVersion(contract),
    license,
    tier: PUBLISH_TIER,
    distribution: 'public',
    status: 'published',
    code: unpacked.code,
    ...(reportDigest === undefined ? {} : { report: reportDigest }),
  }
  return { id, version, entry }
}
