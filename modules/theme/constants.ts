import type { ContractAddition, ContractVersion } from './types'

/**
 * The theme contract version this build implements: a `theme.json` declares the same `major` and a `minor` no higher than this one.
 *
 * @remarks
 * Adding an optional role, layout variant, hook or slot with a core default keeps the major and raises the minor, with a row in
 * `CONTRACT_ADDITIONS` and a section in `docs/themes/contract-changelog.md` (ADR 0005, section 6; ADR 0008, decision 2). A breaking
 * change to roles, modes, variants, hooks, slots or the package layout is the next major, with a migration note. The version is also
 * printed in the generated theme reference. Contract 2 removed the five built-in categories from the slot APIs (ADR 0016).
 */
export const CONTRACT_VERSION: ContractVersion = { major: 2, minor: 0 }

/**
 * What each minor above `.0` of the current major added, so the validator can compute the minimum minor a theme uses.
 *
 * @remarks
 * Empty while the core implements 2.0. Adding to the contract appends a row here with the new minor, raises `CONTRACT_VERSION.minor`
 * and adds the section to `docs/themes/contract-changelog.md`. Names: a slot as in `SLOT_NAMES`, a layout variant as `region:variant`,
 * a role as in the contract, a hook as its class (`myc-…`) or attribute (`data-…`). Limits: a hook counts only when a selector of the
 * theme's CSS uses it (not slot-template markup), and a type-scale role cannot be an addition yet.
 */
export const CONTRACT_ADDITIONS: readonly ContractAddition[] = []

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
  { title: 'Categories', intro: 'The categories are data from the CMS (ADR 0016): `useCategories()` (Nuxt auto-imports it) gives the list, and `categoryColor` from `~/helpers/categories` ranks a slug in it. The core names no category.', files: ['app/composables/useCategories.ts', 'app/helpers/categories.ts'] },
  { title: 'Types', intro: 'Import from `~/interfaces`. Constants that a type is derived from are listed with it.', dir: 'app/interfaces' },
]

/**
 * Common SPDX license ids a theme's `license` may name besides `LicenseRef-*`; a theme is not bound by the AGPL (ADR 0007).
 *
 * @remarks
 * One id, not an expression. Another license, including a proprietary one, is `LicenseRef-<name>`.
 */
export const SPDX_LICENSE_IDS = [
  'MIT', 'MIT-0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0', 'MPL-2.0', 'CC0-1.0', 'Unlicense', 'BlueOak-1.0.0', 'Zlib', 'WTFPL',
  'CC-BY-3.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-ND-4.0', 'OFL-1.1',
  'AGPL-3.0-only', 'AGPL-3.0-or-later', 'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later',
  'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later', 'EUPL-1.2',
] as const

/** Files copied from a theme's `images/`, and the image types a package may hold; anything else is skipped with a warning. */
export const IMAGE_FILE = /\.(png|jpe?g|webp|avif|gif|svg)$/i

/**
 * Pattern of a theme id: 1 to 64 characters, lowercase letters and digits in groups separated by single hyphens (`my-theme`, never `--x`, `x-` or `-`).
 * The id is also the name of the theme's folder, which the loader checks, and the `themeId` of a runtime pin (ADR 0009, section 2).
 *
 * @remarks
 * This pattern does not refuse reserved ids: `themeIdProblem` does, and says why. Contract tightening of #309: before it, ids such as `--x` or `x-` validated.
 */
export const THEME_ID = /^(?=.{1,64}$)[a-z0-9]+(-[a-z0-9]+)*$/

/** Longest `version` of a theme: the pin of a runtime install is capped the same way (ADR 0009, section 2). */
export const VERSION_MAX_LENGTH = 128
/** Strict semver 2.0.0 without build metadata (`+...`): `1.2.3` or `1.2.3-rc.1`. */
export const THEME_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?$/
