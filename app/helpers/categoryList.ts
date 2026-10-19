import type { Category, CategoryEntry, FieldGuideTopic } from '../interfaces/design'

// The theme defines five category color roles, `--category-1` to `--category-5` (ADR 0016, section 3)
const COLOR_ROLES = 5
const NEUTRAL_COLOR = 'var(--ink-muted)'

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
 * The color role of a category: `var(--category-N)`, N being its rank by (`order`, `slug`) in the whole list, modulo the five roles, plus one.
 *
 * @remarks
 * The rank counts empty categories too, so hiding one from a menu moves no color, and it ignores the localized name, so both languages agree. A category that exists in one language only can still shift the colors after it in that language. An unknown slug gets the neutral `var(--ink-muted)`. The CMS `color` field takes over once it exists (ADR 0016, section 10).
 */
export function categoryColorIn(categories: readonly CategoryEntry[], slug: string | null | undefined): string {
  const index = colorRanking(categories).findIndex(category => category.slug === slug)
  return index === -1 ? NEUTRAL_COLOR : `var(--category-${(index % COLOR_ROLES) + 1})`
}

/** The localized name of a category from the list, or its slug when the list does not have it; an empty string for no slug. */
export function categoryNameIn(categories: readonly CategoryEntry[], slug: string | null | undefined): string {
  if (!slug) return ''
  return categories.find(category => category.slug === slug)?.name ?? slug
}

/**
 * The categories the home field guide shows: those with articles, the featured ones first, at most `limit`.
 *
 * @remarks
 * Both groups keep the CMS order. The featured ones become the numbered pillars of the guide (ADR 0016, section 5).
 */
export function fieldGuideTopics(categories: readonly CategoryEntry[], limit: number): FieldGuideTopic[] {
  const filled = categories.filter(category => category.count > 0)
  return [...filled.filter(category => category.featured), ...filled.filter(category => !category.featured)]
    .slice(0, limit)
    // TODO(#462): `FieldGuideTopic.category` becomes a plain string with the contract 2 types
    .map(category => ({ category: category.slug as Category, count: category.count }))
}
