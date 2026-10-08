import { defaultLocale, Locale } from '../interfaces/locale'

/** Regex source for the optional locale prefix of a path (`(?:/es)?`), built from the locales the site has. Relative imports: build modules use it too. */
export function localePrefixSource(): string {
  const prefixes = Object.values(Locale).filter(locale => locale !== defaultLocale).map(locale => `/${locale}`)
  return prefixes.length ? `(?:${prefixes.join('|')})?` : ''
}
