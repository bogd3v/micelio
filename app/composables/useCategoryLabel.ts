import type { CategoryLike } from '~/interfaces'
import { isCategory } from '~/helpers/categories'

/**
 * Returns a function that gives the display label of a category.
 *
 * @remarks
 * A known category slug gives its translated name from `myc.categories`. Any other category gives its name, or its slug when it has no name. A missing category gives an empty string. Call it in setup, because it reads `useI18n`.
 */
export function useCategoryLabel(): (category: CategoryLike | null | undefined) => string {
  const { t } = useI18n()

  return function categoryLabel(category: CategoryLike | null | undefined): string {
    if (!category) return ''
    if (isCategory(category.slug)) return t(`myc.categories.${category.slug}`)
    return category.name ?? category.slug ?? ''
  }
}
