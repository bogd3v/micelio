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
