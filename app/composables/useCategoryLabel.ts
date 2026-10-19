import type { CategoryLike } from '~/interfaces'

/**
 * Returns a function that gives the display label of a category.
 *
 * @remarks
 * The label is the localized `name` of the category in the CMS list; a category the list does not have gives the name it came with, then its slug. A missing category gives an empty string. Call it in setup, because it reads `useCategories`.
 */
export function useCategoryLabel(): (category: CategoryLike | null | undefined) => string {
  const { categories } = useCategories()

  return function categoryLabel(category: CategoryLike | null | undefined): string {
    if (!category) return ''
    const listed = categories.value.find(item => item.slug === category.slug)
    return listed?.name ?? category.name ?? category.slug ?? ''
  }
}
