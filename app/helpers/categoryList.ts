import type { Category, CategoryEntry, FieldGuideTopic } from '../interfaces/design'

// The theme defines five category color roles, `--category-1` to `--category-5` (ADR 0016, section 3)
const COLOR_ROLES = 5
const NEUTRAL_COLOR = 'var(--ink-muted)'

/**
 * The color role of a category: `var(--category-N)`, N being its position in the full ordered list modulo the five roles, plus one.
 *
 * @remarks
 * The position is the one in the whole list, empty categories included, so hiding one from a menu moves no color. An unknown slug gets the neutral `var(--ink-muted)`. The CMS `color` field takes over once it exists (ADR 0016, section 10).
 */
export function categoryColorIn(categories: readonly CategoryEntry[], slug: string | null | undefined): string {
  const index = categories.findIndex(category => category.slug === slug)
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
