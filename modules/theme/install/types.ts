import type { Hooks } from '../types'
import type { ThemePin } from '../registry/types'

/** What went wrong, for a caller to branch on. */
export type InstallRule
  = | 'pin' | 'source' | 'package' | 'identity' | 'code' | 'validation' | 'messages' | 'css' | 'url' | 'assets'
    | 'compile' | 'store' | 'busy' | 'integrity'

/** Where a theme comes from: a pulled or local package with its pin, or a theme folder (the dev loop and the builder). */
export type InstallSource
  = | { kind: 'package', data: Uint8Array, pin: ThemePin, attestation?: Uint8Array }
    | { kind: 'folder', dir: string }

/** What `installTheme` needs besides the source. */
export interface InstallOptions {
  /** The root of the store; the layout version is a folder inside it. */
  storeDir: string
  /** The public hooks of the core (`app/theme/hooks.json`, read with `loadHooks`). */
  hooks: Hooks
  /** Identifies the core build in the compile key; a core upgrade gives new digests. */
  coreBuild: string
  /**
   * Whether a code theme (one with `slots/` or `templates/`) may be installed: the image build does, a server never.
   *
   * @defaultValue false
   */
  allowCode?: boolean
}

/** One file of a compiled entry, as its manifest lists it. */
export interface EntryFile {
  size: number
  /** Lowercase hex SHA-256 of the file. */
  sha256: string
}

/** `manifest.json` of a compiled entry: everything the entry holds, so a loader can refuse a changed, missing or extra file. */
export interface EntryManifest {
  storeVersion: number
  id: string
  version: string
  /** The digest of the entry: the hash of `packageDigest` and `compileKey`. */
  digest: string
  /** `sha256:<hex>` of the `.tgz`, or of the file tree for a folder. */
  packageDigest: string
  compileKey: string
  /** The contract the theme declares, as `major.minor`. */
  contract: string
  code: boolean
  origin: 'package' | 'folder'
  /** Every file of the entry except this manifest, by path. */
  files: Record<string, EntryFile>
}

/** An entry whose manifest verified, with its files held in memory. */
export interface LoadedEntry {
  manifest: EntryManifest
  files: Map<string, Buffer>
}

/** The result of an install. */
export interface InstallResult {
  /** The digest of the compiled entry: the `<digest>` of `/_t/<digest>/`. */
  digest: string
  packageDigest: string
  /** False when an identical entry was already in the store. */
  created: boolean
  manifest: EntryManifest
  /** Files skipped for not being a font or an image, one line each. */
  warnings: string[]
}
