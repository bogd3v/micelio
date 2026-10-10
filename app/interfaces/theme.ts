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
