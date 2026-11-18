import { readGlyph } from '@micelio/icons'
import { ICON_NAME, iconRequestsIn, iconSprite, iconSymbol, iconSymbolId, resolveIcon } from '~/helpers/icons'
import type { IconSources } from '~/helpers/icons'
import type { IconRequest } from '~/interfaces/icons'
import type { H3Event } from 'h3'
import type { BuiltInTheme } from '../lib/types'
import { activeTheme } from './activeTheme'
import { logError, logWarn } from './log'

/** The names already reported as unknown: one line per name for the life of the process. */
const reported = new Set<string>()
let failureReported = false

/** Forgets the names reported as unknown; for tests. */
export function resetReportedIcons(): void {
  reported.clear()
  failureReported = false
}

/** The lookups of a page: the theme's `icons/<name>.svg`, then the core's set. */
export function iconSources(theme?: BuiltInTheme): IconSources {
  return {
    theme: (name) => {
      const file = theme?.entry.files.get(`icons/${name}.svg`)
      return file ? file.toString('utf8') : undefined
    },
    core: (name, style) => readGlyph(name, style),
  }
}

/**
 * The sprite markup for the icons a page asked for, or the empty string when it asked for none or none resolves.
 *
 * @remarks
 * A name that resolves to nothing (not in the catalogue, or a glyph `iconSymbol` refuses) is logged once per process as `icons.unknown`,
 * with the name only when it is a plausible one: a value from content never goes into a log line. The page then has no symbol for it
 * and the `<use>` draws nothing. A glyph that cannot be read at all is left out the same way and logged once as `icons.read`.
 */
export async function spriteFor(requests: Iterable<IconRequest>, sources: IconSources): Promise<string> {
  return iconSprite(await symbolsFor(requests, sources))
}

/** The `<symbol>` of each icon asked for by its id; what `spriteFor` wraps, and what a response carries (`withIconSymbols`). Resolves like `spriteFor`. */
export async function symbolsFor(requests: Iterable<IconRequest>, sources: IconSources): Promise<Map<string, string>> {
  const symbols = new Map<string, string>()
  for (const { name, style } of requests) {
    const id = iconSymbolId(name, style)
    if (symbols.has(id)) continue
    let glyph: string | undefined
    try {
      glyph = await resolveIcon(name, style, sources)
    } catch (error) {
      // A glyph that cannot be read (a build without the package's files) must not take the page down: the icon is left out and the first failure is logged
      if (!failureReported) {
        failureReported = true
        logError('icons.read', 'A glyph could not be read', { error })
      }
      continue
    }
    const symbol = glyph === undefined ? undefined : iconSymbol(id, glyph)
    if (symbol) {
      symbols.set(id, symbol)
    } else if (!reported.has(name)) {
      reported.add(name)
      logWarn('icons.unknown', 'An icon resolves to nothing, in the theme and in the core', { cause: ICON_NAME.test(name) ? name : 'invalid name' })
    }
  }
  return symbols
}

/**
 * A page-data response with the symbols of the icons it uses, for a client-side navigation to draw them (ADR 0021, section 3).
 *
 * @remarks
 * The first page of a visit has its sprite from `server/plugins/iconSprite.ts`; a page the browser renders by itself has only what the
 * response gives it. The icons are found by `iconRequestsIn` in the response and added as `iconSymbols` (symbol id to markup), nothing
 * when it has none, so a response without icons is the response it was. The symbols are resolved as the sprite's are, against the theme
 * this request began with. No request for an icon file is made: they travel inside the response.
 */
export async function withIconSymbols<T extends object>(body: T, event: H3Event): Promise<T & { iconSymbols?: Record<string, string> }> {
  const requests = iconRequestsIn(body)
  const symbols = await symbolsFor(requests, iconSources((event.context.activeTheme as BuiltInTheme | undefined) ?? activeTheme()))
  return symbols.size === 0 ? body : { ...body, iconSymbols: Object.fromEntries(symbols) }
}
