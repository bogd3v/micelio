import type { ComputedRef } from 'vue'
import type { CategoryCount, Locale } from '~/interfaces'

/** The categories of the CMS in the current locale and the ways to ask about them. */
export interface UseCategories {
  /** The categories with their article counts, in the CMS order (`order`, then `name`). Empty while loading, on a failure and for a site with none. */
  categories: ComputedRef<CategoryCount[]>
  /** Whether the request failed, so an empty list does not mean "no categories". */
  failed: ComputedRef<boolean>
  /** Whether the CMS has a category with this slug. */
  has: (slug: string) => boolean
  /** Resolves once the list has loaded, on the server and on the client. */
  loaded: () => Promise<void>
}

/**
 * The categories of the CMS, shared by every component of a page: it wraps the `fetchCategories` request, whose key is per locale, so a page makes one request to `/api/categories` (ADR 0016, section 2).
 *
 * @remarks
 * Call it in `setup`. Await `loaded()` where the answer decides the page, such as a 404 for an unknown category.
 */
export function useCategories(): UseCategories {
  const { locale } = useI18n()
  const { fetchCategories } = useStrapi()

  const request = fetchCategories(locale.value as Locale)
  const categories = computed<CategoryCount[]>(() => request.data.value ?? [])
  const failed = computed<boolean>(() => Boolean(request.error.value))

  function has(slug: string): boolean {
    return categories.value.some(category => category.slug === slug)
  }

  async function loaded(): Promise<void> {
    await request
  }

  return { categories, failed, has, loaded }
}
