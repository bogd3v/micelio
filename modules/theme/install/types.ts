import type { ContrastRule, Hooks, LayoutRegion, ModeDefinition, ModePalette, SlotName, SlotOptions, ThemeManifest } from '../types'
import type { ThemeDisplay } from '../display-family'
import type { ThemePin } from '../registry/types'

/** What went wrong, for a caller to branch on. */
export type InstallRule
  = | 'pin' | 'source' | 'package' | 'identity' | 'code' | 'validation' | 'messages' | 'css' | 'url' | 'assets'
    | 'compile' | 'store' | 'busy' | 'integrity'

/** Where a theme comes from: a pulled or local package with its pin, or a theme folder (the dev loop and the builder). */
export type InstallSource
  = | { kind: 'package', data: Uint8Array, pin: ThemePin, attestation?: Uint8Array }
    | { kind: 'folder', dir: string }

/** The core's CSS of each layout variant, by region and variant name (`readLayoutCss`); the entry carries the ones a theme chose. */
export type LayoutCss = Partial<Record<LayoutRegion, Record<string, string>>>

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
  /**
   * Run the checks the Nuxt build makes (contract, public hooks, the package) and skip the admission checks of `theme:check` (contrast, static budgets).
   * Only the image's own build sets it, for themes the operator installed by hand: a server install always runs them.
   *
   * @defaultValue false
   */
  buildChecksOnly?: boolean
  /**
   * The core's CSS of the layout variants (ADR 0009, section 6). The entry's stylesheet carries the CSS of the variants the theme
   * chose, so `coreBuild` must identify these bytes: a change to the CSS is a new core build.
   *
   * @defaultValue no variant CSS
   */
  layoutCss?: LayoutCss
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

/** A font of `runtime.json`: the manifest's font with the URL it is served at. */
export interface RuntimeFont {
  family: string
  file: string
  preload?: boolean
  /** `/_t/<digest>/fonts/<file>`. */
  url: string
}

/**
 * `runtime.json` of a compiled entry: what the server reads about the theme, in place of the build-time `#micelio/theme*` modules (ADR 0009, section 6).
 *
 * @remarks
 * Written by `compileTheme` and read back by `parseRuntime`, which checks every field before any value reaches HTML.
 */
export interface RuntimeData {
  id: string
  name?: string
  version?: string
  /** The digest of the entry (`/_t/<digest>/`). */
  digest: string
  packageDigest: string
  /** `major.minor`. */
  contract: string
  code: boolean
  modes: ModeDefinition[]
  fonts: RuntimeFont[]
  /** Role to `/_t/<digest>/images/<file>`. */
  images: Partial<Record<'favicon' | 'ogImage' | 'profile', string>>
  layout: Record<LayoutRegion, string>
  slots: Partial<Record<SlotName, SlotOptions>>
  mermaid: NonNullable<ThemeManifest['mermaid']>
  display: ThemeDisplay
  palette: { modes: Record<string, ModePalette>, rules: ContrastRule[] }
  /** Messages by locale, each compiled to the AST the client formats without a compiler. */
  messages: Record<string, Record<string, unknown>>
}

/**
 * `index.json` of the built-in store: which themes the image holds, written at build and read at boot.
 *
 * @remarks
 * Every theme of the image is installed with `allowCode`, so a code theme is in the store only because the build compiled its slots (ADR 0009, section 4).
 */
export interface BuiltInIndex {
  /** The core build the entries were compiled for (the compile key's input). */
  coreBuild: string
  /** The theme the build was made for: the default when nothing else is configured. */
  buildTheme: string
  themes: Record<string, { digest: string, version: string, code: boolean }>
}
