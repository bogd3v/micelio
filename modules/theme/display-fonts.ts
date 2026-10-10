import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { addTypeTemplate } from 'nuxt/kit'
import { copyServed, FONT_FILE, STATIC_CSP } from './assets'
import type { ThemeContext } from './types'

// The curated display fonts of the core (ADR 0005, section 8): served at /fonts/display/, emitted by server/utils/displayFonts.ts.

const MODULE = '#micelio/display-fonts'
/**
 * Folder of the curated display fonts, relative to the project root.
 *
 * @internal Exported for tests.
 */
export const DISPLAY_FONTS_DIR = 'app/assets/fonts/display'
export const DISPLAY_FONTS_URL = '/fonts/display'

interface DisplayFontAssets {
  /** First 8 hex digits of the sha256 of each font file, the `?v=` of its URL */
  versions: Record<string, string>
  /** The minified fallback `@font-face` rules of each font (`font-fallbacks.css`) */
  fallbacks: Record<string, string>
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

/** Reads the font files of `dir` and `display-fallbacks.css` next to it. Fonts with no section in the CSS get an empty fallback. */
export function readDisplayFontAssets(dir: string): DisplayFontAssets {
  const versions: Record<string, string> = {}
  for (const file of existsSync(dir) ? readdirSync(dir) : []) {
    const id = /^(.+)-latin-wght\.woff2$/.exec(file)?.[1]
    if (id) versions[id] = createHash('sha256').update(readFileSync(join(dir, file))).digest('hex').slice(0, 8)
  }
  const fallbacks: Record<string, string> = {}
  const file = join(dir, '../display-fallbacks.css')
  const css = existsSync(file) ? readFileSync(file, 'utf8') : ''
  for (const [, id = '', body = ''] of css.matchAll(/\/\* ([a-z-]+) \*\/([\s\S]*?)(?=\/\* [a-z-]+ \*\/|$)/g)) {
    fallbacks[id] = body.replace(/\s*([{};:,])\s*/g, '$1').replace(/;}/g, '}').trim()
  }
  return { versions, fallbacks }
}

/** Serves the curated fonts at /fonts/display/ and gives the server their versions, fallbacks and the theme's own display family. */
export function setupDisplayFonts(ctx: ThemeContext): void {
  const { nuxt } = ctx
  const source = join(nuxt.options.rootDir, DISPLAY_FONTS_DIR)
  const target = join(nuxt.options.buildDir, 'micelio/display-fonts')
  const copy = (): void => copyServed(ctx, source, target, DISPLAY_FONTS_DIR, FONT_FILE, 'a font or a license (woff, woff2, txt)')
  copy()
  // First: the dev server matches prefixes in order, and /fonts/ would answer 404 for /fonts/display/
  // The URL carries ?v=<hash of the file>, so a year of caching is safe (the theme's own /fonts/ is not versioned and keeps maxAge 0)
  ;(nuxt.options.nitro.publicAssets ||= []).unshift({ dir: target, baseURL: DISPLAY_FONTS_URL, maxAge: 60 * 60 * 24 * 365 })
  // Whatever the theme ships: the sandbox CSP of its own /fonts/ also covers these files
  ;(nuxt.options.routeRules ||= {})[`${DISPLAY_FONTS_URL}/**`] = { headers: { 'Content-Security-Policy': STATIC_CSP } }
  // The build empties buildDir after the modules are set up, so the copy is made again once the templates are written
  nuxt.hook('app:templatesGenerated', () => {
    if (!existsSync(target)) copy()
  })
  nuxt.hook('nitro:config', (config) => {
    config.virtual ||= {}
    const { fonts, type } = ctx.load().manifest
    const web = (fonts ?? []).map(font => font.family)
    const theme = {
      family: stackFamily(type?.families?.display ?? ''),
      // The theme's own file for that family, preloaded at build; kept in the page when the body text uses the family too
      file: (fonts ?? []).find(font => font.family.toLowerCase() === stackFamily(type?.families?.display ?? '').toLowerCase())?.file,
      sharedWithSans: stackFamily(type?.families?.sans ?? '').toLowerCase() === stackFamily(type?.families?.display ?? '').toLowerCase(),
      display: systemStack(type?.families?.display ?? '', web),
      sans: systemStack(type?.families?.sans ?? '', web),
    }
    config.virtual[MODULE] = `export const assets = ${JSON.stringify(readDisplayFontAssets(source))}\nexport const themeDisplay = ${JSON.stringify(theme)}\n`
  })
  addTypeTemplate({
    filename: 'types/micelio-display-fonts.d.ts',
    getContents: () => `declare module '${MODULE}' {
  export const assets: { versions: Record<string, string>, fallbacks: Record<string, string> }
  export const themeDisplay: { family: string, file?: string, sharedWithSans: boolean, display: string, sans: string }
}
`,
  }, { nitro: true, nuxt: true })
}
