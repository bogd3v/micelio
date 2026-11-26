import type { AccentColors } from './site'

/**
 * A mode id declared by the active theme (`light` | `dark` in the starter).
 *
 * @public
 */
export type ThemeMode = string

/**
 * A mode of the active theme, as the theme module lists it.
 *
 * @public
 */
export interface ThemeModeDefinition {
  id: ThemeMode
  /** The colour scheme the mode uses; the page's `data-scheme` attribute follows it. */
  scheme: 'dark' | 'light'
  /** The label when the messages have no `theme.modes.<id>` entry; `useTheme` falls back to the id. */
  name?: string
}

/**
 * What a page needs of the active theme, sent to the client in the payload (ADR 0009, section 6).
 *
 * @remarks
 * Read from the theme store on the server and shared by every request, so it is frozen: never change it.
 */
export interface ThemeData {
  id: string
  /** The digest of the theme's entry in the store, `/_t/<digest>/`. */
  digest: string
  modes: ThemeModeDefinition[]
  /** Role to the URL the file is served at. */
  images: Partial<Record<'favicon' | 'ogImage' | 'profile', string>>
  /** The layout variant of each region. */
  layout: Record<'header' | 'home' | 'postList' | 'article' | 'footer', string>
  /** Mermaid theme variable overrides. */
  mermaid: Record<string, string>
  /** Whether the entry ships `sections.css`, which the page sections link (`/_t/<digest>/sections.css`). */
  sections: boolean
  /**
   * Whether every slot renders the core's default in `app/theme/defaults/`, even when a theme of the build has the same id: set only for the preview of a theme the image was not built with (ADR 0019, amendment of 2026-11-25).
   *
   * @defaultValue false
   */
  defaultSlots?: boolean
}

/** The `theme.*` messages of one locale, compiled to the AST vue-i18n formats without a compiler. */
export type ThemeMessages = Record<string, unknown>

/**
 * Why a switch did not happen, for a reader to branch on: `pin` (the pin in the site settings is not valid), `unknown` (the image has no such theme),
 * `code` (a theme with slots the image was not built with), `off` (the theme is not in the store and installing is off),
 * `tier` (its tier is not installed here), `limit` (the install rate, the backoff or the size of the store), `registry`, `install` and `integrity`.
 */
export type ThemeSwitchRule = 'pin' | 'unknown' | 'code' | 'off' | 'tier' | 'limit' | 'registry' | 'install' | 'integrity'

/** What the site settings ask for: an id alone (a theme built into the image) or an exact version and the digest of its package. */
export interface RequestedTheme {
  id: string
  version?: string
  digest?: string
}

/** A theme the server holds, as the status names it. */
export interface ThemeIdentity {
  id: string
  version?: string
  /** The `<digest>` of `/_t/<digest>/`. */
  digest: string
  /** `sha256:` of the package; the value `themeDigest` pins. */
  packageDigest: string
}

/** The last switch that did not happen. */
export interface ThemeSwitchFailure {
  rule: ThemeSwitchRule
  /** One line; it holds no URL and no file path. */
  message: string
  /** ISO time. */
  at: string
  requested: RequestedTheme | null
}

/**
 * What `GET /api/theme/status` answers (ADR 0009, section 6): the theme the server renders and the one the site settings ask for.
 *
 * @remarks
 * The CMS reads it to show the editor whether a change took effect and why not. It holds nothing secret: the ids and digests are in every page.
 */
export interface ThemeStatus {
  active: ThemeIdentity
  /** What the site settings name now; `null` when they name none and the instance's default applies. */
  requested: RequestedTheme | null
  /** The theme that was active before the last switch. */
  lastGood: ThemeIdentity | null
  /** Why the last attempt failed, until a later one succeeds. The active theme is the last good one meanwhile. */
  error: ThemeSwitchFailure | null
  available: {
    /** Themes compiled into the image. A code theme activates only from here, at the digest the image was built with. */
    builtIn: Array<{ id: string, version?: string, code: boolean }>
    /** Whether a data-only theme named by a pin is installed from the registry when the store lacks it, and the tiers it may have. */
    registry: { install: boolean, tiers: string[] }
  }
}

/** Who stands behind a version of the registry (ADR 0008, decision 7). */
export type CatalogueTier = 'official' | 'verified' | 'community'

/** A theme of one of this server's stores, as the catalogue lists it. */
export interface CatalogueInstalledTheme {
  id: string
  version: string
  /** `sha256:` of the package: the digest the lock pins for a built-in theme from the registry, else the digest of the entry's package or file tree. */
  packageDigest: string
  /** The contract the theme declares, as `major.minor`. */
  contract: string
  /** Whether the theme ships slots, which only an image built with it runs (ADR 0009, section 4). */
  code: boolean
  /** `built-in`: compiled into the image; `deployment`: installed into `MICELIO_THEME_STORE`. */
  store: 'built-in' | 'deployment'
  /** From the index, when it lists this version with this package digest. */
  tier?: CatalogueTier
  /** The SPDX id of the index, when it lists this version with this package digest. */
  license?: string
  /** The digest of the admission report the index names for this version, when it lists it with this package digest. */
  report?: string
}

/** One version of a theme of the registry's index, as the catalogue lists it. */
export interface CatalogueVersion {
  version: string
  /** `sha256:` of the package. */
  digest: string
  contract: string
  license: string
  tier: CatalogueTier
  /** `licensed` versions are listed as the index lists them; nothing here downloads them. */
  distribution: 'public' | 'licensed'
  status: 'published' | 'yanked' | 'incompatible'
  code: boolean
  /** The digest of the version's admission report, when the index names one. */
  report?: string
  /** Whether this core runs the version: it implements its contract and the index does not mark it incompatible with this core. */
  runs: boolean
}

/** A theme of the registry's index, its versions newest first. */
export interface CatalogueTheme {
  id: string
  versions: CatalogueVersion[]
}

/** A newer version of an installed theme that this server could take. */
export interface CatalogueUpdate {
  id: string
  /** The installed version. */
  from: string
  store: CatalogueInstalledTheme['store']
  /** The newest version of the index that is `published`, newer than `from` and runs on this core. */
  version: string
  digest: string
}

/** The result of an admission report the index names, read from the registry after its digest matched. */
export interface CatalogueReport {
  id: string
  version: string
  /** The `report` digest of the index. */
  digest: string
  /** Whether admission found no error. */
  ok: boolean
  /** The Markdown summary of the report (`reportSummary`). */
  summary: string
}

/**
 * What `GET /api/theme/catalogue` answers: the installed themes, the registry's themes, the updates and the admission reports, for the Themes page of the CMS (bogd3v/micelio-plugin-core#59).
 *
 * @remarks
 * Built in the background from the signed index and the stores, and answered from memory (ADR 0009, sections 3 and 6). It holds nothing secret: no token, licence key, URL query or file system path.
 */
export interface ThemeCatalogue {
  installed: CatalogueInstalledTheme[]
  /** The themes of the verified index, by id; `null` when the index has not been read or did not verify. */
  registry: CatalogueTheme[] | null
  /** Why the last read of the index failed, or why none is made; one line with no URL and no path. `null` after a read that succeeded. */
  reason: string | null
  updates: CatalogueUpdate[]
  /** At most 50: the newest `published` version of each theme and each installed version, for those whose report was read. */
  reports: CatalogueReport[]
}

/** One pair of the contrast matrix of ADR 0005, section 1, in one mode: a foreground role on a surface. */
export interface ContrastPairResult {
  role: string
  surface: string
  /** The measured WCAG 2 ratio, floored to two decimals as `theme:check` prints it; `null` when a color cannot be measured. */
  ratio: number | null
  min: number
  /** Whether the unrounded ratio reaches `min`. */
  passes: boolean
}

/** The contrast matrix of one mode of the active theme, with the candidate accent applied. */
export interface ContrastModeReport {
  mode: string
  /** The accent family the candidate resolves to, after the adjustment of ADR 0005 section 8; `null` when the theme's own accent stays (no candidate, the theme's own color, or none that reaches contrast). */
  accent: AccentColors | null
  pairs: ContrastPairResult[]
}

/** What `GET /_micelio/contrast` answers: the active theme's matrix in every mode, as `theme:check` measures it. */
export interface ContrastReportResponse {
  data: {
    /** The id of the active theme. */
    theme: string
    modes: ContrastModeReport[]
  }
}
