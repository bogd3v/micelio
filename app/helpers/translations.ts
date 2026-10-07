import type { LocalePaths, PostTranslation, StrapiLocalization } from '~/interfaces'
import type { Locale } from '~/interfaces/locale'
import { isLocale, localizedPath } from '~/helpers/locale'

export function publishedTranslations(localizations: StrapiLocalization[] | null | undefined): PostTranslation[] {
  return (localizations ?? [])
    .filter(localization => Boolean(localization.publishedAt) && Boolean(localization.slug) && isLocale(localization.locale))
    .map(localization => ({ locale: localization.locale as Locale, slug: localization.slug }))
}

export function articlePath(slug: string, locale: Locale): string {
  return localizedPath(`/blog/${slug}`, locale)
}

export function articlePaths(slug: string, locale: Locale, translations: PostTranslation[]): LocalePaths {
  const paths: LocalePaths = { [locale]: articlePath(slug, locale) }
  for (const translation of translations) {
    if (translation.locale !== locale) paths[translation.locale] = articlePath(translation.slug, translation.locale)
  }
  return paths
}

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

export function pagePaths(slug: string, locale: Locale, translations: PostTranslation[], homeSlugs: HomeSlugs = {}): LocalePaths {
  const paths: LocalePaths = { [locale]: pagePath(slug, locale) }
  for (const translation of translations) {
    if (translation.locale !== locale) paths[translation.locale] = translationPath(translation, homeSlugs)
  }
  return paths
}
