import { hasInjectionContext, inject } from 'vue'
import type { ComputedRef, InjectionKey } from 'vue'
import type { CategoryEntry, Locale } from '~/interfaces'
import { categoryColor } from '~/helpers/categories'
import { categoryNameIn } from '~/helpers/categoryList'

/**
 * The injection key of a fixed category list, which `useCategories()` reads instead of calling the CMS; the `/_theme` specimen provides it.
 *
 * @internal
 */
export const CATEGORIES_SOURCE: InjectionKey<readonly CategoryEntry[]> = Symbol('micelio-categories-source')

/**
 * The categories of the CMS in the current locale and the ways to ask about them.
 *
 * @public
 */
export interface UseCategories {
  /** Every category in the CMS order (`order`, then `name`), empty ones included. Empty while loading, on a failure, for a site with none and for a site with no blog. */
  categories: ComputedRef<CategoryEntry[]>
  /** The categories with published articles, in the same order: what menus, filters and feeds list. */
  listed: ComputedRef<CategoryEntry[]>
  /** Whether the request failed, so an empty list does not mean "no categories". */
  failed: ComputedRef<boolean>
  /** Whether the CMS has a category with this slug. */
  has: (slug: string) => boolean
  /** The color role of a category by its rank in the full list (`categoryColor`); neutral for an unknown slug. */
  colorOf: (slug: string | null | undefined) => string
  /** The localized name of a category; its slug when the list does not have it. */
  labelOf: (slug: string | null | undefined) => string
  /** Resolves once the list has loaded, on the server and on the client. */
  loaded: () => Promise<void>
}

/**
 * The categories of the CMS, shared by every component of a page: it wraps the `fetchCategories` request, whose key follows the locale, so a page makes one request to `/api/categories` (ADR 0016, section 2).
 *
 * @remarks
 * Call it in `setup`. Await `loaded()` where the answer decides the page, such as a 404 for an unknown category. A site with no blog (a landing with no articles) makes no request and has no categories.
 *
 * @public
 */
export function useCategories(): UseCategories {
  const { locale } = useI18n()
  const { fetchCategories } = useStrapi()
  const { blogEnabled } = useStaticSite()

  const fixed = hasInjectionContext() ? inject(CATEGORIES_SOURCE, null) : null
  // The key follows the locale: the blog page is reused when the language changes, so setup does not run again
  const request = blogEnabled && !fixed ? fetchCategories(computed(() => locale.value as Locale)) : null
  const categories = computed<CategoryEntry[]>(() => fixed ? [...fixed] : request?.data.value ?? [])
  const listed = computed<CategoryEntry[]>(() => categories.value.filter(category => category.count > 0))
  const failed = computed<boolean>(() => Boolean(request?.error.value))

  function has(slug: string): boolean {
    return categories.value.some(category => category.slug === slug)
  }

  function colorOf(slug: string | null | undefined): string {
    return categoryColor(categories.value, slug)
  }

  function labelOf(slug: string | null | undefined): string {
    return categoryNameIn(categories.value, slug)
  }

  async function loaded(): Promise<void> {
    await request
  }

  return { categories, listed, failed, has, colorOf, labelOf, loaded }
}
