import type { LocationQuery } from 'vue-router'

/**
 * The locales the site serves. Each value is the locale code the CMS uses.
 *
 * @public
 */
export enum Locale {
  English = 'en',
  SpanishColombia = 'es',
}

/**
 * A locale code as the CMS sends it; not limited to the values of `Locale`.
 *
 * @public
 */
export type LocaleCode = Locale | string

/**
 * The locale a page falls back to when none is given: English.
 *
 * @public
 */
export const defaultLocale = Locale.English

/**
 * Where the language switcher sends the visitor: the same page in another locale.
 *
 * @public
 */
export interface LocaleSwitchTarget {
  path: string
  query: LocationQuery
  hash: string
}

/**
 * The translated path of the current page for each locale. A locale missing here has no translation of the page.
 *
 * @public
 */
export type LocalePaths = Partial<Record<Locale, string>>

/**
 * The paths a page offers in each locale, and whether they are listed as hreflang alternates.
 *
 * @public
 */
export interface LocaleAlternates {
  /** The page's path in the current locale. */
  path: string
  paths: LocalePaths
  /** False: the page lists no hreflang alternates, but the language switcher still uses `paths` */
  hreflang?: boolean
}
