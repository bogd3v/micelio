import { DISPLAY_FONTS } from '~/interfaces/site'
import type { DisplayFont } from '~/interfaces/site'

// The curated display fonts (ADR 0005, section 8). Everything emitted comes from this table and the build's assets, never from the CMS string.

interface DisplayFontSpec {
  family: string
  /** `font-weight` range of the file's `wght` axis */
  weights: string
  kind: 'sans' | 'serif'
}

// Keep in step with scripts/perf/subset-display-fonts.py and the families of scripts/perf/font-fallbacks.py
const SPECS: Record<DisplayFont, DisplayFontSpec> = {
  'archivo': { family: 'Archivo', weights: '100 900', kind: 'sans' },
  'fraunces': { family: 'Fraunces', weights: '100 900', kind: 'serif' },
  'bricolage-grotesque': { family: 'Bricolage Grotesque', weights: '200 800', kind: 'sans' },
  'newsreader': { family: 'Newsreader', weights: '200 800', kind: 'serif' },
  'space-grotesk': { family: 'Space Grotesk', weights: '300 700', kind: 'sans' },
}

/** The latin subset of the files (the range of themes/bogota/fonts.css) */
const UNICODE_RANGE = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD'

/** What the build knows (`#micelio/display-fonts`): file versions and generated fallback faces per font id. */
interface DisplayFontAssets {
  versions: Record<string, string>
  fallbacks: Record<string, string>
}

/** The theme's own display family and the system part of its display and sans stacks (its own web fonts left out). */
interface ThemeDisplay {
  family: string
  /** The theme's own font file for `family` (preloaded at build) and whether the body text uses `family` too */
  file?: string
  sharedWithSans?: boolean
  display: string
  sans: string
}

const GENERIC = { sans: 'system-ui,sans-serif', serif: 'Georgia,"Times New Roman",serif' }

/** The tail of a font's stack: the theme's own when it ends in the font's generic family, else a generic stack. */
function tail(kind: 'sans' | 'serif', theme: ThemeDisplay): string {
  const own = (kind === 'serif' ? theme.display : theme.sans).split(',').map(name => name.trim()).filter(Boolean)
  const generic = kind === 'serif' ? 'serif' : 'sans-serif'
  return own.length && own.at(-1)!.toLowerCase() === generic ? own.join(',') : GENERIC[kind]
}

interface DisplayFontOverride {
  css: string
  /** URL of the font file, as in the `@font-face` and the preload link */
  href: string
}

const URANGE = 'U\\+[\\dA-F]{1,4}(?:-[\\dA-F]{1,4})?'
const NAME = '[A-Za-z][A-Za-z0-9 -]*'
const FONT_FACE = `@font-face\\{font-family:"${NAME}";font-style:normal;font-display:swap;font-weight:\\d{3} \\d{3};src:url\\("/fonts/display/[a-z-]+-latin-wght\\.woff2\\?v=[\\da-f]{8}"\\) format\\("woff2"\\);unicode-range:${URANGE}(?:,${URANGE})*\\}`
const FALLBACK_FACE = `@font-face\\{font-family:"${NAME} Fallback";font-weight:\\d{3} \\d{3};src:local\\("${NAME}"\\)(?:,local\\("${NAME}"\\))*;size-adjust:[\\d.]+%;ascent-override:[\\d.]+%;descent-override:[\\d.]+%;line-gap-override:0%\\}`
const STACK = `"${NAME}","${NAME} Fallback"(?:,[A-Za-z0-9" -]+)*`
/**
 * The shape of everything emitted: faces, then `--font-display`. No `<`, no free-form value.
 *
 * @internal Exported for tests.
 */
export const DISPLAY_FONT_RULE = new RegExp(`^${FONT_FACE}(?:${FALLBACK_FACE})+:root\\{--font-display:${STACK}\\}$`)

/** The enum value as a font, or undefined for anything else (inherited keys included). */
export function displayFontId(value: unknown): DisplayFont | undefined {
  return typeof value === 'string' && (DISPLAY_FONTS as readonly string[]).includes(value) ? value as DisplayFont : undefined
}

/**
 * The `@font-face` rules, fallback faces and `--font-display` for `font`, and the file to preload; null when nothing is emitted:
 * no font, an unknown one, the one the theme already uses, or one the build lacks (a font or version missing, or a CSS that fails the whitelist).
 */
export function displayFontOverride(font: string | undefined, theme: ThemeDisplay, assets: DisplayFontAssets): DisplayFontOverride | null {
  const id = displayFontId(font)
  if (!id) return null
  const { family, weights, kind } = SPECS[id]
  if (family.toLowerCase() === theme.family.toLowerCase()) return null
  const version = Object.hasOwn(assets.versions, id) ? assets.versions[id] : undefined
  const fallback = Object.hasOwn(assets.fallbacks, id) ? assets.fallbacks[id] : undefined
  if (!version || !fallback) return null
  const href = `/fonts/display/${id}-latin-wght.woff2?v=${version}`
  const stack = [`"${family}"`, `"${family} Fallback"`, tail(kind, theme)].join(',')
  const css = `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weights};src:url("${href}") format("woff2");unicode-range:${UNICODE_RANGE}}${fallback}:root{--font-display:${stack}}`
  if (!DISPLAY_FONT_RULE.test(css)) {
    console.error(`Display font "${id}" left out: the CSS does not match the expected shape`)
    return null
  }
  return { css, href }
}

interface ThemeFontFile {
  file: string
  preload?: boolean
}

const STYLESHEET_LINK = /<link rel="stylesheet"[^>]*>/

/**
 * The theme's `<link rel="preload">` tags for its fonts, in manifest order. They are rendered here and not by the build-time
 * head (which the client would add again on hydration) so that an emitted display override can leave out the theme's own
 * display file: dead weight, unless the body text uses the same family (`sharedWithSans`).
 */
export function themePreloadLinks(fonts: ThemeFontFile[], theme: ThemeDisplay, overridden: boolean): string {
  return fonts
    .filter(font => font.preload && !(overridden && !theme.sharedWithSans && font.file === theme.file))
    .map(font => `<link rel="preload" href="/fonts/${font.file}" as="font" type="font/woff2" crossorigin>`)
    .join('')
}

/** `links` right after the first stylesheet link of the head chunks (where the build-time head put them), else at the end. */
export function insertAfterStylesheet(head: string[], links: string): string[] {
  if (!links) return head
  const index = head.findIndex(chunk => STYLESHEET_LINK.test(chunk))
  if (index === -1) return [...head, links]
  return head.map((chunk, i) => (i === index ? chunk.replace(STYLESHEET_LINK, tag => tag + links) : chunk))
}
