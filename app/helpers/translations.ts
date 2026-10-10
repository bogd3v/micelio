import type { LocalePaths, PostTranslation, StrapiLocalization } from '~/interfaces'
import type { Locale } from '~/interfaces/locale'
import { isLocale, localizedPath } from '~/helpers/locale'

/**
 * The translations of an article that are published, have a slug and a supported locale, as `{ locale, slug }`.
 *
 * @remarks
 * Other localizations are left out, and `null` or `undefined` gives an empty array.
 */
export function publishedTranslations(localizations: StrapiLocalization[] | null | undefined): PostTranslation[] {
  return (localizations ?? [])
    .filter(localization => Boolean(localization.publishedAt) && Boolean(localization.slug) && isLocale(localization.locale))
    .map(localization => ({ locale: localization.locale as Locale, slug: localization.slug }))
}

/** The site path of an article in a locale: `/blog/<slug>`, with the locale prefix except for the default locale. */
export function articlePath(slug: string, locale: Locale): string {
  return localizedPath(`/blog/${slug}`, locale)
}

/**
 * The `hreflang` paths of an article, keyed by locale: its own path and the path of each translation.
 *
 * @remarks
 * A translation in the same locale as `locale` is skipped.
 */
export function articlePaths(slug: string, locale: Locale, translations: PostTranslation[]): LocalePaths {
  const paths: LocalePaths = { [locale]: articlePath(slug, locale) }
  for (const translation of translations) {
    if (translation.locale !== locale) paths[translation.locale] = articlePath(translation.slug, translation.locale)
  }
  return paths
}

/** The site path of a section page in a locale: `/<slug>`, with the locale prefix except for the default locale. */
export function pagePath(slug: string, locale: Locale): string {
  return localizedPath(`/${slug}`, locale)
}

type HomeSlugs = Partial<Record<Locale, string | undefined>>

/** A translation's canonical path: its language's root when it is that language's home page (`homeSlugs`), else its own slug. */
function translationPath(translation: PostTranslation, homeSlugs: HomeSlugs): string {
  return homeSlugs[translation.locale] === translation.slug ? localizedPath('/', translation.locale) : pagePath(translation.slug, translation.locale)
}

/** hreflang of a page that is the home page here: its root, and each translation at its canonical path. */
export function homePaths(locale: Locale, translations: PostTranslation[], homeSlugs: HomeSlugs): LocalePaths {
  const paths: LocalePaths = { [locale]: localizedPath('/', locale) }
  for (const translation of translations) {
    if (translation.locale !== locale) paths[translation.locale] = translationPath(translation, homeSlugs)
  }
  return paths
}

/**
 * The `hreflang` paths of a section page, keyed by locale.
 *
 * @remarks
 * A translation that is its language's home page (`homeSlugs`) is listed at that language's root. A translation in the same locale as
 * `locale` is skipped.
 */
export function pagePaths(slug: string, locale: Locale, translations: PostTranslation[], homeSlugs: HomeSlugs = {}): LocalePaths {
  const paths: LocalePaths = { [locale]: pagePath(slug, locale) }
  for (const translation of translations) {
    if (translation.locale !== locale) paths[translation.locale] = translationPath(translation, homeSlugs)
  }
  return paths
}
