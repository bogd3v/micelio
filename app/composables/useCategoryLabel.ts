import type { CategoryLike } from '~/interfaces'
import { isCategory } from '~/helpers/categories'

export function useCategoryLabel(): (category: CategoryLike | null | undefined) => string {
  const { t } = useI18n()

  return function categoryLabel(category: CategoryLike | null | undefined): string {
    if (!category) return ''
    if (isCategory(category.slug)) return t(`myc.categories.${category.slug}`)
    return category.name ?? category.slug ?? ''
  }
}
