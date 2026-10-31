import type { H3Event } from 'h3'
import type { BuiltInTheme } from '../types'
import { isStaticMode } from '~/helpers/siteMode'
import { defaultLocale } from '~/interfaces/locale'
import type { Locale } from '~/interfaces/locale'
import type { SiteMode, SiteTheme } from '~/interfaces/site'
import type { ThemeData, ThemeMessages } from '~/interfaces/theme'

/** The request header the theme's digest travels in, so a page cache that lists it in `varies` keeps one entry per theme (docs/api.md, "Theme status"). */
export const THEME_HEADER = 'x-micelio-theme'

/**
 * Pins a request to the theme that is active when it arrives: the render, the payload and any cache key read this theme, however long the render takes.
 *
 * @remarks
 * The header is always overwritten, so a visitor cannot choose which theme's page a cache keyed by it hands out (ADR 0009, section 8).
 *
 * @param view - The theme's data and messages, shared and frozen.
 */
export function pinRequestToTheme(event: Pick<H3Event, 'context' | 'node'>, theme: BuiltInTheme, view: { data: ThemeData, messages: Record<string, ThemeMessages> }): void {
  event.context.activeTheme = theme
  event.context.theme = view.data
  event.context.themeMessages = view.messages
  event.node.req.headers[THEME_HEADER] = theme.runtime.digest
}

/**
 * Whether the site settings just read decide the theme: those of the default language on a server (the field is not translated), never on a static or landing build, which resolves its theme itself (#315).
 *
 * @param siteMode - The mode the build was made for.
 */
export function decidesTheme(locale: Locale, siteMode: SiteMode): boolean {
  return locale === defaultLocale && !isStaticMode(siteMode)
}

/**
 * The overrides of the CMS (`site.theme`) a page may render, or `undefined` when they were resolved against another theme than the one the page renders.
 *
 * @remarks
 * `loadSite` resolves accents against the theme that was active when it ran. A switch can happen while a page renders, so the page checks the digest
 * it began with: overrides for another theme's palette would not have been checked for contrast against this one.
 *
 * @param loaded - The cached site settings, or `undefined` when the CMS did not answer.
 * @param digest - The digest of the theme the page renders.
 */
export function overridesFor(loaded: { themeDigest: string, site: { theme?: SiteTheme } } | undefined, digest: string): SiteTheme | undefined {
  return loaded?.themeDigest === digest ? loaded.site.theme : undefined
}
