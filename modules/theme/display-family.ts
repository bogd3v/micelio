import type { ThemeManifest } from './types'

/** What the server needs of a theme's own display family (`#micelio/display-fonts` at build, `runtime.json` in a store). */
export interface ThemeDisplay {
  family: string
  /** The theme's own file for that family, preloaded; kept in the page when the body text uses the family too. */
  file?: string
  sharedWithSans: boolean
  display: string
  sans: string
}

const unquote = (name: string): string => name.trim().replace(/^["']|["']$/g, '')

/** The family a stack starts with. */
export function stackFamily(stack: string): string {
  return unquote(stack.split(',')[0] ?? '')
}

/** The stack without the theme's own web fonts and their `<family> Fallback` faces (what is left is the system part). */
export function systemStack(stack: string, webFamilies: string[]): string {
  const own = webFamilies.flatMap(family => [family.toLowerCase(), `${family} Fallback`.toLowerCase()])
  return stack.split(',').map(name => name.trim()).filter(name => name && !own.includes(unquote(name).toLowerCase())).join(', ')
}

/** The display-family data of a theme, from its manifest alone. */
export function themeDisplay(manifest: Pick<ThemeManifest, 'fonts' | 'type'>): ThemeDisplay {
  const { fonts, type } = manifest
  const web = (fonts ?? []).map(font => font.family)
  const display = stackFamily(type?.families?.display ?? '')
  return {
    family: display,
    file: (fonts ?? []).find(font => font.family.toLowerCase() === display.toLowerCase())?.file,
    sharedWithSans: stackFamily(type?.families?.sans ?? '').toLowerCase() === display.toLowerCase(),
    display: systemStack(type?.families?.display ?? '', web),
    sans: systemStack(type?.families?.sans ?? '', web),
  }
}
