import { NEUTRAL_CATEGORY_COLOR } from '../constants/categories'
import type { CategoryEntry } from '../interfaces/design'

// The theme defines five category color roles, `--category-1` to `--category-5` (ADR 0016, section 3)
const COLOR_ROLES = 5

/**
 * The categories in the order that ranks their colors: `order` ascending, those without one last, then `slug`.
 *
 * @remarks
 * The display order breaks ties by the localized name, which differs between languages; the slug does not, so a category keeps its color when the language changes.
 */
function colorRanking(categories: readonly CategoryEntry[]): CategoryEntry[] {
  return [...categories].sort((a, b) => {
    const left = a.order ?? Number.POSITIVE_INFINITY
    const right = b.order ?? Number.POSITIVE_INFINITY
    if (left !== right) return left < right ? -1 : 1
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
  })
}

/**
 * The color role of every category of the list by slug: `var(--category-N)`, N being its rank by (`order`, `slug`) modulo the five roles, plus one.
 *
 * @remarks
 * `useCategories()` computes it once per list; `categoryColor` is the one-off entry point over the same ranking.
 */
export function categoryColorRoles(categories: readonly CategoryEntry[]): Map<string, string> {
  return new Map(colorRanking(categories).map((category, index) => [category.slug, `var(--category-${(index % COLOR_ROLES) + 1})`]))
}

/**
 * The color role of a category: `var(--category-N)`, N being its rank by (`order`, `slug`) in the whole list, modulo the five roles, plus one.
 *
 * @remarks
 * This is the one implementation: `useCategories().colorOf(slug)` and the tags, cards and illustrations of the core call it, so a slot that colors by it matches them. The ranking is by `order`, then `slug`, never by the localized name, so both languages agree: this is a promise of the slot API. The rank counts empty categories too, so hiding one from a menu moves no color, and it ignores the localized name, so both languages agree. An unknown slug, or no slug, gets the neutral `var(--ink-muted)`. The CMS `color` field takes over once it exists (ADR 0016, section 10).
 *
 * @param categories - The whole list, as `useCategories().categories` gives it.
 * @param slug - The category slug to color.
 *
 * @example
 * ```ts
 * const { categories } = useCategories()
 * categoryColor(categories.value, 'kitchen') // 'var(--category-2)' when it ranks second
 * ```
 *
 * @public
 */
export function categoryColor(categories: readonly CategoryEntry[], slug: string | null | undefined): string {
  return (slug ? categoryColorRoles(categories).get(slug) : undefined) ?? NEUTRAL_CATEGORY_COLOR
}
