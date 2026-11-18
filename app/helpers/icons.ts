// Icons (ADR 0021): a name resolves to a glyph, and the glyphs a page uses become one inline sprite.
// Pure: the files are read by the caller (server/utils/iconSprite.ts), which hands over the lookups.
import type { IconRequest, IconStyle } from '~/interfaces/icons'

/** What a name of the catalogue looks like: lower-case words and digits joined by hyphens. Anything else is never looked up. */
export const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Where a lookup finds a glyph: an SVG text, or nothing. */
type GlyphLookup = (name: string, style: IconStyle) => string | undefined | Promise<string | undefined>

/** The two places a name is looked up, in order (ADR 0021, section 2). */
export interface IconSources {
  /** The active theme's `icons/<name>.svg`, when it ships that file. A theme draws a name once, whatever the style asked. Absent for a theme with no `icons/`. */
  theme?: (name: string) => string | undefined | Promise<string | undefined>
  /** The core's set (`@micelio/icons`): `filled` answers `undefined` for a name with no filled alternate. */
  core: GlyphLookup
}

/** The id of the `<symbol>` of a name in a style: `myc-i-<name>`, and `myc-i-<name>-filled` for the filled one. */
export function iconSymbolId(name: string, style: IconStyle = 'outline'): string {
  return `myc-i-${name}${style === 'filled' ? '-filled' : ''}`
}

/**
 * The glyph of a name in a style: the active theme's drawing first, then the core's, or `undefined` when neither has the name.
 *
 * @remarks
 * `filled` falls back to `outline` in the core for a name with no filled alternate. A name that is not a name of the catalogue
 * (`ICON_NAME`) is not looked up at all, so a value from content never reaches a file path.
 */
export async function resolveIcon(name: string, style: IconStyle, sources: IconSources): Promise<string | undefined> {
  if (!ICON_NAME.test(name)) return undefined
  const drawn = await sources.theme?.(name)
  if (drawn) return drawn
  return (await sources.core(name, style)) ?? (style === 'filled' ? await sources.core(name, 'outline') : undefined)
}

// A glyph is one `<svg>` of shapes: nothing else becomes part of a page (a theme's files are checked here until its admission rules exist, ADR 0021 step 2)
const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g'])
const SHAPE_ATTRIBUTES = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform', 'fill', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'])
const ROOT_ATTRIBUTES = new Set(['xmlns', 'viewBox', 'fill', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width'])
const TAG = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z0-9-]+="[^"<>&]*")*)\s*(\/?)>/y
const ATTRIBUTE = /\s+([a-zA-Z0-9-]+)="([^"]*)"/g
// A colour literal or a reference would break the theme's roles (ADR 0021, section 4): only these values for the paint attributes
const PAINT = /^(?:none|currentColor)$/

function attributesOf(source: string, allowed: Set<string>): Array<[string, string]> | undefined {
  const found: Array<[string, string]> = []
  for (const [, key, value] of source.matchAll(ATTRIBUTE)) {
    if (!key || !allowed.has(key)) return undefined
    if ((key === 'fill' || key === 'stroke') && !PAINT.test(value ?? '')) return undefined
    found.push([key, value ?? ''])
  }
  return found
}

/**
 * The `<symbol>` of a glyph, or `undefined` when the text is not a glyph the page may hold.
 *
 * @remarks
 * Accepts one `<svg>` with a `viewBox` and only shapes inside (`path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`,
 * `g`), with their geometry and paint attributes; paint is `none` or `currentColor`. A script, a style, a link, an event attribute,
 * an `id` or a colour literal makes the whole glyph `undefined`. The root's presentation attributes (`fill`, `stroke`…) move to the
 * symbol, which the `<use>` shows with the stroke width of `MycIcon`'s `stroke-width` attribute (a theme's CSS can override it).
 */
export function iconSymbol(id: string, glyph: string): string | undefined {
  const text = glyph.trim()
  let at = 0
  let root: Array<[string, string]> | undefined
  let depth = 0
  let body = ''
  while (at < text.length) {
    TAG.lastIndex = at
    const tag = TAG.exec(text)
    if (!tag) return undefined
    at = TAG.lastIndex
    const [whole, closing, rawName, rawAttributes = '', selfClosing] = tag
    const name = rawName ?? ''
    if (root === undefined) {
      if (name !== 'svg' || closing || selfClosing) return undefined
      root = attributesOf(rawAttributes, ROOT_ATTRIBUTES)
      if (!root?.some(([key]) => key === 'viewBox')) return undefined
      depth = 1
      continue
    }
    if (name === 'svg') {
      if (!closing) return undefined
      depth--
      // The closing tag ends the glyph: nothing may follow it
      return depth === 0 && at === text.length ? symbolOf(id, root, body) : undefined
    }
    if (!SHAPES.has(name) || attributesOf(rawAttributes, SHAPE_ATTRIBUTES) === undefined) return undefined
    body += whole
  }
  return undefined
}

function symbolOf(id: string, root: Array<[string, string]>, body: string): string {
  const attributes = root.filter(([key]) => key !== 'xmlns').map(([key, value]) => ` ${key}="${value}"`).join('')
  return `<symbol id="${id}"${attributes}>${body}</symbol>`
}

/**
 * The sprite of a page: one hidden `<svg>` holding a `<symbol>` per entry, or the empty string for no entries.
 *
 * @remarks
 * The empty string is what lets a page without icons stay byte for byte as it was. The map is keyed by symbol id, so each id appears
 * once; its values are the output of `iconSymbol`.
 */
export function iconSprite(symbols: ReadonlyMap<string, string>): string {
  if (symbols.size === 0) return ''
  return `<svg xmlns="http://www.w3.org/2000/svg" id="myc-icons" width="0" height="0" focusable="false" aria-hidden="true" style="position:absolute;overflow:hidden">${[...symbols.values()].join('')}</svg>`
}

/** Most distinct icons one response carries symbols for: a bound on its growth (a page with more draws the rest from nothing). */
export const MAX_RESPONSE_ICONS = 100
const MAX_DEPTH = 12

/**
 * The icons a response uses, by the field convention of the block contract: an object with a string `icon` that is a catalogue name, and `iconStyle: 'filled'` for the filled drawing.
 *
 * @remarks
 * Run on what a route is about to send (its public shape), so a block that keeps `icon` in its allow-list is found with no change to the route.
 * Each name and style once, in the order found, at most `MAX_RESPONSE_ICONS`.
 */
export function iconRequestsIn(value: unknown): IconRequest[] {
  const found = new Map<string, IconRequest>()
  function walk(node: unknown, depth: number): void {
    if (depth > MAX_DEPTH || found.size >= MAX_RESPONSE_ICONS || typeof node !== 'object' || node === null) return
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    const record = node as Record<string, unknown>
    if (typeof record.icon === 'string' && ICON_NAME.test(record.icon)) {
      const style: IconStyle = record.iconStyle === 'filled' ? 'filled' : 'outline'
      found.set(iconSymbolId(record.icon, style), { name: record.icon, style })
    }
    for (const child of Object.values(record)) walk(child, depth + 1)
  }
  walk(value, 0)
  return [...found.values()]
}

// What a symbol of a server response may look like, checked again in the browser before it enters the page: one `<symbol>` of shapes and their attributes, no event, link or style attribute
const SYMBOL_ATTRIBUTE = '(?!on|href|xlink|style)[a-zA-Z][a-zA-Z0-9-]*="[^"<>&]*"'
const SYMBOL = new RegExp(`^<symbol id="(myc-i-[a-z0-9]+(?:-[a-z0-9]+)*)"(?: ${SYMBOL_ATTRIBUTE})*>(?:<(?:path|circle|ellipse|rect|line|polyline|polygon|g)(?: ${SYMBOL_ATTRIBUTE})* ?/?>|</g>)*</symbol>$`, 'i')

/** The id of a `<symbol>` that `iconSymbol` could have written, or `undefined` for any other text. */
export function iconSymbolIdOf(markup: string): string | undefined {
  return SYMBOL.exec(markup)?.[1]
}
