import type { Category, CategoryInfo } from '../interfaces/design'

// Category is an enum, which a constants file may not import at runtime: the slugs are written as literals,
// and `satisfies` makes the compiler reject any slug that is not a value of the enum
const SLUGS = ['privacidad', 'diy', 'ia', 'software', 'linux'] as const satisfies readonly `${Category}`[]

/**
 * The categories in display order; a category's color role is its position here (`categoryColor`).
 *
 * @public
 */
export const CATEGORIES: readonly Category[] = SLUGS as readonly Category[]

/**
 * Per-category data: the pillar (1 or 2) of the two that have one, else null.
 *
 * @public
 */
export const CATEGORY_INFO: Readonly<Record<Category, CategoryInfo>> = {
  privacidad: { pillar: 1 },
  diy: { pillar: 2 },
  ia: { pillar: null },
  software: { pillar: null },
  linux: { pillar: null },
}
