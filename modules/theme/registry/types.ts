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
