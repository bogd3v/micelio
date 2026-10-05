/** A mode id declared by the active theme (`noche` | `dia` in Bogotá). */
export type ThemeMode = string

export interface ThemeModeDefinition {
  id: ThemeMode
  scheme: 'dark' | 'light'
  name?: string
}
