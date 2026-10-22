/**
 * A mode id declared by the active theme (`noche` | `dia` in Bogotá).
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
