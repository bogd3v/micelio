import type { CategoryEntry, FieldGuideTopic } from '../interfaces/design'

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
    .map(category => ({ category: category.slug, count: category.count }))
}
