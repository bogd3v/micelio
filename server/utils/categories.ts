import qs from 'qs'
import { shapeCategories, type RawCategory } from '../lib/categoryList'
import type { LoadedCategory } from '../lib/types'

const MAX_CATEGORIES = 100

async function fetchCategories(locale: string | undefined): Promise<LoadedCategory[]> {
  const params = qs.stringify({
    pagination: { pageSize: MAX_CATEGORIES },
    fields: ['name', 'slug', 'description', 'order', 'pillar'],
    locale,
    populate: {
      articles: {
        fields: ['id'],
        filters: { locale: { $eq: locale ?? 'en' } },
      },
    },
  }, { skipNulls: true })
  try {
    const response = await strapiFetch<{ data?: RawCategory[] }>(`/api/categories?${params}`)
    return shapeCategories(response.data ?? [])
  } catch (error: unknown) {
    logError('cms.categories', 'Fetching the categories failed', { error })
    throw upstreamFailure(error, 'Failed to fetch categories')
  }
}

/**
 * The categories of the CMS with their published article counts in one locale, sorted by `order`, then `name`.
 *
 * @remarks
 * Cached for 10 minutes per locale, stale while revalidating; a failure is thrown and not stored. This is the only source of categories on the server: routes check a slug against it, never against a constant (ADR 0016). A new category takes up to the cache time to appear.
 *
 * @throws A problem detail from `upstreamFailure` when the CMS fails.
 */
export const loadCategories = defineCachedFunction(fetchCategories, {
  name: 'categories',
  getKey: (locale: string | undefined) => locale ?? 'default',
  maxAge: 600,
  swr: true,
})

/** The category with this slug in the list of the locale, or undefined when the CMS has none. */
export async function findCategory(slug: string, locale: string | undefined): Promise<LoadedCategory | undefined> {
  return (await loadCategories(locale)).find(category => category.slug === slug)
}
