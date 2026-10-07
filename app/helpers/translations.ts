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

/** hreflang of a page that is the home page: each language it exists in answers at its own root. */
export function homePaths(locale: Locale, translations: PostTranslation[]): LocalePaths {
  const paths: LocalePaths = { [locale]: localizedPath('/', locale) }
  for (const translation of translations) paths[translation.locale] = localizedPath('/', translation.locale)
  return paths
}

export function pagePaths(slug: string, locale: Locale, translations: PostTranslation[]): LocalePaths {
  const paths: LocalePaths = { [locale]: pagePath(slug, locale) }
  for (const translation of translations) {
    if (translation.locale !== locale) paths[translation.locale] = pagePath(translation.slug, translation.locale)
  }
  return paths
}
