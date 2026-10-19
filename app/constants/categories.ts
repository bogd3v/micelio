/**
 * The provide and inject key of a fixed category list, which `useCategories()` reads instead of calling the CMS; the `/_theme` specimen provides it.
 *
 * @internal
 */
export const CATEGORIES_SOURCE_KEY = 'micelio-categories-source'

/** The color of a category the list does not have: a neutral text role, not one of the five category roles (ADR 0016, section 3). */
export const NEUTRAL_CATEGORY_COLOR = 'var(--ink-muted)'
