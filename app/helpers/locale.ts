import type { LocationQuery } from 'vue-router'
import { defaultLocale, Locale } from '~/interfaces/locale'

const PER_LOCALE_PARAMS = new Set<string>(['page'])
const LOCALES = new Set<string>(Object.values(Locale))

/** The query to keep when the language changes: every parameter except the per-locale ones (`page`). */
export function localeSwitchQuery(query: LocationQuery): LocationQuery {
  return Object.fromEntries(Object.entries(query).filter(([key]) => !PER_LOCALE_PARAMS.has(key)))
}

/** Whether a value is one of the supported locales; a type guard. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.has(value)
}

/**
 * A site path with its locale prefix; the default locale has none.
 *
 * @remarks
 * A path without a leading slash gets one. The root of a non-default locale is `/<locale>`, not `/<locale>/`.
 */
export function localizedPath(path: string, locale: Locale): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (locale === defaultLocale) return clean
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`
}
