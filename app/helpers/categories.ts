import type { Category } from '../interfaces/design'
import { CATEGORIES } from '../constants/categories'

/**
 * The theme contract exposes these through this module (slot APIs, ADR 0005).
 *
 * @public
 */
export { CATEGORIES, CATEGORY_INFO } from '../constants/categories'

/**
 * Whether `value` is one of the category slugs; narrows it to `Category` when so.
 *
 * @public
 */
export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

/**
 * The category's color role: `var(--category-N)`, N being its position in CATEGORIES.
 *
 * @public
 */
export function categoryColor(category: Category): string {
  return `var(--category-${CATEGORIES.indexOf(category) + 1})`
}

/**
 * The display position of a category slug. Unknown or missing slugs sort after every category.
 *
 * @public
 */
export function categoryOrder(slug: string | null | undefined): number {
  const index = CATEGORIES.indexOf(slug as Category)
  return index === -1 ? CATEGORIES.length : index
}
