import type { ContractUsage } from '../types'

/** The rule a package broke, for a caller to branch on (the message names the rule and the path). */
export type UnpackRule
  = | 'compressed-size' | 'ratio' | 'gzip' | 'trailing-data' | 'tar' | 'entry-type' | 'mode'
    | 'path' | 'path-length' | 'depth' | 'duplicate' | 'entries' | 'file-size' | 'unpacked-size'
    | 'allowlist' | 'magic' | 'svg' | 'json' | 'missing' | 'digest' | 'manifest'

/** A file of a package, as the manifest lists it. */
interface PackageFile {
  /** Path inside the package, with `/` separators. */
  path: string
  size: number
  /** Lowercase hex SHA-256 of the file. */
  sha256: string
}

/** `<id>-<version>.manifest.json`: what a package holds. Informative; the `.tgz` digest is the trust anchor (ADR 0009, section 3). */
export interface PackageManifest {
  id: string
  name: string
  version: string
  contract: Pick<ContractUsage, 'declared' | 'used'>
  license: string
  /** Whether the package ships `slots/` or `templates/` (ADR 0009, section 4). */
  code: boolean
  files: PackageFile[]
  /** Sum of the file sizes. */
  size: number
  /** The `theme:check` result the package passed with. */
  check: { errors: 0, warnings: string[] }
}

/** What `unpackTheme` accepts besides the bytes. */
export interface UnpackOptions {
  /** The `sha256:<hex>` of the `.tgz` the caller pinned (the trust anchor); a different digest is refused before decompression. */
  digest: string
  /** The sibling manifest, as read. When given, every file is checked against it. */
  manifest?: string | Uint8Array
}

/** A package that passed every rule. */
export interface UnpackedTheme {
  /** The files by path, as unpacked from the one buffer that was verified. */
  files: Map<string, Uint8Array>
  /** Decided from the files, never from the manifest: `slots/`, `templates/` or a code file anywhere. */
  code: boolean
  /** `sha256:<hex>` of the `.tgz` bytes. */
  digest: string
  /** Sum of the file sizes. */
  size: number
}

/** Who stands behind a theme (ADR 0008, decision 7); `local` is a package added from a file, vouched for by nobody. */
export type ThemeTier = 'official' | 'verified' | 'community' | 'local'

/** How a package is obtained: from the registry, from a license server (#320, not implemented) or from a local file. */
export type ThemeDistribution = 'public' | 'licensed' | 'file'

/** What a pin names: one exact version of one theme and the digest of its `.tgz` (ADR 0009, section 2). */
export interface ThemePin {
  id: string
  version: string
  /** `sha256:<hex>` of the `.tgz`. */
  digest: string
}

/** One entry of `themes.lock.json`: a pin and what was known when it was resolved. */
export interface LockEntry extends Omit<ThemePin, 'id'> {
  /** The contract the package declares, as `major.minor`. */
  contract: string
  tier: ThemeTier
  distribution: ThemeDistribution
  /** Where the entry was resolved (`MICELIO_THEME_REGISTRY` at that time), so a lock keeps its meaning when the variable changes; `null` for a file. */
  registry: string | null
  /** Whether the package ships `slots/` or `templates/`, which only an image built with it can run (ADR 0009, section 4). */
  code: boolean
}

/** The content of `themes.lock.json`, by theme id. */
export type ThemeLock = Record<string, LockEntry>

/** What a failed pull, lock or pin check was about, for a caller to branch on. */
export type RegistryFailure
  = | 'pin' | 'lock' | 'network' | 'registry' | 'size' | 'digest' | 'identity' | 'contract' | 'not-found' | 'unsupported'
    | 'attestation' | 'signature' | 'trust-root' | 'listing' | 'signer'

/** The signer identities a registry's attestations must come from, each matched whole (ADR 0009, section 3). */
export interface SignerIdentity {
  /** The OIDC issuer of the signing certificate. */
  issuer: string
  /** The subject alternative name of the workflow that signs packages. */
  packages: string
  /** The subject alternative name of the workflow that signs the index. */
  index: string
}

/** One version of a theme in the index. */
export interface IndexVersion {
  /** The `sha256:` digest of the `.tgz`, which is also the digest of the package artifact's layer. */
  digest: string
  /** The theme contract the version declares, as `major.minor`. */
  contract: string
  /** The SPDX id (or `LicenseRef-*`) from the package's `theme.json`. */
  license: string
  tier: Exclude<ThemeTier, 'local'>
  distribution: Exclude<ThemeDistribution, 'file'>
  /** `yanked` stays pullable for locks that pin it and is never resolved for a new range. */
  status: 'published' | 'yanked' | 'incompatible'
  /** Whether the package ships `slots/` or `templates/`. */
  code: boolean
  /** The `sha256:` digest of the admission report attached to the package artifact as a referrer. */
  report?: string | undefined
  /** Why and when the version was yanked; present only with status `yanked`. */
  yank?: { reason: string, at: string } | undefined
}

/** The index: `themes[id].versions[version]`. */
export interface RegistryIndex {
  version: 1
  themes: Record<string, { versions: Record<string, IndexVersion> }>
}

/** The digest a signed statement must name. */
export interface BundleSubject {
  algorithm: 'sha256' | 'sha512'
  /** Lowercase hex. */
  hex: string
}

/** What `verifyBundle` checks a bundle against. */
export interface VerifyBundleOptions {
  subject: BundleSubject
  /** The exact subject alternative name of the signing certificate. */
  san: string
  /** The exact OIDC issuer of the signing certificate. */
  issuer: string
  /** The Sigstore trusted root to verify against; the one shipped with Micelio when not given. */
  root?: unknown
}

/** A function that verifies a bundle, so callers can be tested without real signatures. */
export type BundleVerifier = (bundle: Uint8Array, options: VerifyBundleOptions) => void
