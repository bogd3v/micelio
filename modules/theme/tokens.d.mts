export interface ThemeTokenGroup {
  tokens: Array<{ name: string, value: string | Record<string, string>, at?: Record<string, string> }>
}

export interface ThemeData {
  id?: string
  name?: string
  modes: Array<{ id: string, scheme: 'dark' | 'light', name?: string }>
  color: ThemeTokenGroup
  shadow?: ThemeTokenGroup
  spacing?: ThemeTokenGroup
  radius?: ThemeTokenGroup
  size?: ThemeTokenGroup
  motion?: ThemeTokenGroup
  type?: {
    families?: Record<string, string>
    groups?: Array<{ family: string, styles: Array<{ name: string, fontSize: string, lineHeight: string, fontWeight: number, letterSpacing?: string }> }>
  }
}

/** Role values for every mode of a theme; `aliases` adds selectors per mode id. */
export function buildTokensCss(data: ThemeData, aliases?: Record<string, string[]>): string
