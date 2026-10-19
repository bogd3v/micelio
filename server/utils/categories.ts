import qs from 'qs'
import { defaultLocale } from '~/interfaces/locale'
import { mergeLocalized, shapeCategories, type RawCategory } from '../lib/categoryList'
import { MAX_CATEGORIES } from '../lib/constants'
import type { LoadedCategory } from '../lib/types'

async function fetchLocale(locale: string): Promise<LoadedCategory[]> {
  const params = qs.stringify({
    pagination: { pageSize: MAX_CATEGORIES },
    // Needs a CMS with `featured` and `color` (the 0.4 line): Strapi rejects an unknown field (ADR 0016, section 10)
    fields: ['name', 'slug', 'description', 'order', 'featured', 'color'],
    locale,
    populate: {
      articles: {
        fields: ['id'],
        filters: { locale: { $eq: locale } },
      },
    },
  })
  const response = await strapiFetch<{ data?: RawCategory[] }>(`/api/categories?${params}`)
  return shapeCategories(response.data ?? [])
}

async function fetchCategories(locale: string): Promise<LoadedCategory[]> {
  try {
    if (locale === defaultLocale) return await fetchLocale(locale)
    const [base, localized] = await Promise.all([fetchLocale(defaultLocale), fetchLocale(locale)])
    return mergeLocalized(base, localized)
  } catch (error: unknown) {
    logError('cms.categories', 'Fetching the categories failed', { error })
    throw upstreamFailure(error, 'Failed to fetch categories')
  }
}

const cachedCategories = defineCachedFunction(fetchCategories, {
  name: 'categories',
  getKey: (locale: string) => locale,
  maxAge: 600,
  swr: true,
})

/**
 * The categories of the CMS with their published article counts in one locale, sorted by `order`, then `name`.
 *
 * @remarks
 * Cached for 10 minutes per locale, stale while revalidating; a failure is thrown and not stored. This is the only source of categories on the server: routes check a slug against it, never against a constant (ADR 0016). A new category takes up to the cache time to appear. It reads at most 100 categories (one page). A category with no translation in the locale is listed with its slug as its name and no articles; an absent locale is the default one.
 *
 * @throws A problem detail from `upstreamFailure` when the CMS fails.
 */
export function loadCategories(locale?: string): Promise<LoadedCategory[]> {
  return cachedCategories(locale ?? defaultLocale)
}

/** The category with this slug in the list of the locale, or null when the CMS has none. */
export async function findCategory(slug: string, locale?: string): Promise<LoadedCategory | null> {
  return (await loadCategories(locale)).find(category => category.slug === slug) ?? null
}
