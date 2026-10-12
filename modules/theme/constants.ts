/** The regions of the page whose layout variant a theme can choose (ADR 0005). */
export const LAYOUT_REGIONS = ['header', 'home', 'postList', 'article', 'footer'] as const

/** The slots a theme can fill with its own component (ADR 0005, section 4). */
export const SLOT_NAMES = ['ThemeMark', 'ThemeHero', 'ThemeDivider', 'ThemeEmptyState', 'ThemeIllustration', 'ThemeProgressMarker', 'ThemeSupportArt'] as const

/** A group of the slot APIs: the only parts of the core a slot may call or import (ADR 0005, amendment of 2026-10-06). */
export interface SlotApiGroup {
  /** The heading of the group in `docs/themes/reference/slot-apis.md`. */
  title: string
  /** What a slot imports from the group, and from where. */
  intro: string
  /** Source files, relative to the repository root, whose public-tagged declarations make up the group. */
  files?: readonly string[]
  /** A folder whose `.ts` files (recursively, its top-level `index.ts` excluded) make up the group instead of `files`. */
  dir?: string
}

/**
 * The slot APIs, the one list the generated reference and its check read; a declaration tagged public in any other file fails the generation.
 *
 * @remarks
 * `useAnimations()` is in the ADR 0005 amendment but was never implemented, so it is not here (#426).
 */
export const SLOT_API_GROUPS: readonly SlotApiGroup[] = [
  { title: 'Site', intro: 'The composable for the site identity (name, description, links, modules); Nuxt auto-imports it.', files: ['app/composables/useSite.ts'] },
  { title: 'Category helpers', intro: 'Import from `~/helpers/categories`; `CATEGORIES` and `CATEGORY_INFO` are re-exported there.', files: ['app/helpers/categories.ts', 'app/constants/categories.ts'] },
  { title: 'Types', intro: 'Import from `~/interfaces`. Constants that a type is derived from are listed with it.', dir: 'app/interfaces' },
]
