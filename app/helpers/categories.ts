import { Category } from '../interfaces/design'
import type { CategoryInfo } from '../interfaces/design'

export const CATEGORIES: readonly Category[] = [
  Category.Privacy,
  Category.Diy,
  Category.Ai,
  Category.Software,
  Category.Linux,
]

export const CATEGORY_INFO: Readonly<Record<Category, CategoryInfo>> = {
  [Category.Privacy]: { pillar: 1 },
  [Category.Diy]: { pillar: 2 },
  [Category.Ai]: { pillar: null },
  [Category.Software]: { pillar: null },
  [Category.Linux]: { pillar: null },
}

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
