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
export type RegistryFailure = 'pin' | 'lock' | 'network' | 'registry' | 'size' | 'digest' | 'identity' | 'contract' | 'not-found' | 'unsupported'
