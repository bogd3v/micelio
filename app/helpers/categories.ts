import type { Category } from '../interfaces/design'
import { CATEGORIES } from '../constants/categories'

// The theme contract exposes these through this module (slot APIs, ADR 0005)
export { CATEGORIES, CATEGORY_INFO } from '../constants/categories'

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

/** The category's color role: `var(--category-N)`, N being its position in CATEGORIES. */
export function categoryColor(category: Category): string {
  return `var(--category-${CATEGORIES.indexOf(category) + 1})`
}

export function categoryOrder(slug: string | null | undefined): number {
  const index = CATEGORIES.indexOf(slug as Category)
  return index === -1 ? CATEGORIES.length : index
}
