import type { ContractAddition, ContractVersion, ContrastRule, LayoutRegion } from './types'

/**
 * The theme contract version this build implements: a `theme.json` declares the same `major` and a `minor` no higher than this one.
 *
 * @remarks
 * Adding an optional role, layout variant, hook or slot with a core default keeps the major and raises the minor, with a row in
 * `CONTRACT_ADDITIONS` and a section in `docs/themes/contract-changelog.md` (ADR 0005, section 6; ADR 0008, decision 2). A breaking
 * change to roles, modes, variants, hooks, slots or the package layout is the next major, with a migration note. The version is also
 * printed in the generated theme reference. Contract 2 removed the five built-in categories from the slot APIs (ADR 0016). A new
 * performance budget a theme can fail raises the minor too (ADR 0005, section 9).
 */
export const CONTRACT_VERSION: ContractVersion = { major: 2, minor: 5 }

/**
 * What each minor above `.0` of the current major added, so the validator can compute the minimum minor a theme uses.
 *
 * @remarks
 * 2.1 added the presentation options of the blocks as hooks, 2.2 the carbon budget, 2.4 the `myc-news-consent` hook, 2.5 the `myc-group` hook of a band of page sections (2.3 is reserved for the region options, ADR 0005; `docs/themes/contract-changelog.md`). Adding to the contract appends a row here with the new minor, raises `CONTRACT_VERSION.minor`
 * and adds the section to `docs/themes/contract-changelog.md`. Names: a slot as in `SLOT_NAMES`, a layout variant as `region:variant`,
 * a role as in the contract, a hook as its class (`myc-…`) or attribute (`data-…`), a budget as its metric in `scripts/perf/budgets.json`.
 * Limits: a hook counts only when a selector of the theme's CSS uses it (not slot-template markup), and a type-scale role cannot be an
 * addition yet. A budget binds every theme and no theme uses it, so it never raises the minor a theme must declare.
 */
export const CONTRACT_ADDITIONS: readonly ContractAddition[] = [
  { minor: 1, kind: 'hook', name: 'data-width' },
  { minor: 1, kind: 'hook', name: 'data-columns' },
  { minor: 1, kind: 'hook', name: 'data-density' },
  { minor: 1, kind: 'hook', name: 'data-align' },
  { minor: 1, kind: 'hook', name: 'data-tone' },
  { minor: 1, kind: 'hook', name: 'data-ratio' },
  { minor: 1, kind: 'hook', name: 'data-height' },
  { minor: 2, kind: 'budget', name: 'co2Mg' },
  { minor: 4, kind: 'hook', name: 'myc-news-consent' },
  { minor: 5, kind: 'hook', name: 'myc-group' },
]

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

/** Where the theme's images are served: `/theme/images/<file>` (docs/adr/0005-theme-contract.md). */
export const IMAGES_URL = 'theme/images'

/** Variant each region renders when the theme does not name one. */
export const DEFAULT_LAYOUT: Record<LayoutRegion, string> = {
  header: 'bar',
  home: 'showcase',
  postList: 'grid',
  article: 'aside',
  footer: 'columns',
}

/** CSS functions whose string arguments are URLs, so a theme's stylesheet is checked and rewritten for them like for `url()`. */
export const URL_FUNCTIONS: ReadonlySet<string> = new Set(['image-set', '-webkit-image-set', 'src', 'image', 'cross-fade', '-webkit-cross-fade'])

/** Files served from a theme's `fonts/`: fonts and their license texts; anything else is skipped with a warning. Not `FONT_FILE` of the contract, which names the font files a `theme.json` may declare. */
export const FONT_ASSET_FILE = /\.(woff2?|txt)$/i

// The contrast rules of ADR 0005, section 1 (WCAG 2 AA) and its 2026-10-06 amendment, which `theme:check` and `GET /_micelio/contrast` measure
// with `contrastPairs` (app/helpers/contrast.ts)

/**
 * Minimum contrast ratio of text (WCAG 2 AA).
 *
 * @internal Exported for tests.
 */
export const TEXT_MIN = 4.5
const CONTROL_MIN = 3

const SURFACES = ['surface', 'surface-raised', 'surface-sunken']
/** The surface the `tone: accent` option of a section puts under its text (#731). */
const TONE_SURFACES = ['accent-soft']
const STATES = ['success', 'warning', 'danger', 'info']
const CATEGORY_ROLES = [1, 2, 3, 4, 5].map(n => `category-${n}`)

/** Text roles: on the three surfaces and on their own `-soft` (when it exists). */
const SOFT_TEXT = ['accent', 'link', ...STATES, ...CATEGORY_ROLES]

/**
 * The contrast every installed theme must meet in every mode (ADR 0005, section 1 and its 2026-10-06 amendment).
 *
 * @remarks
 * Text meets `TEXT_MIN` (4.5:1): `ink` and `ink-muted` on the three surfaces; the `code-*` roles on `surface-sunken`; `on-ink` on `ink`; `on-accent` on `accent`
 * and `accent-hover`; `accent`, `link`, the states and the categories on the three surfaces and on their own `-soft` role.
 * From contract 2.1, `ink`, `ink-muted` and `link` are also held on `accent-soft`, which `tone: accent` makes the surface of a section (#731);
 * a theme that declares an older contract is not (`ContrastRule.since`).
 * `line-strong` and `focus` meet 3:1 on the surfaces. An optional role the theme omits is checked with its core default. `theme:check`
 * adds the `contrast` assertions that a theme declares on its tokens.
 */
export const CONTRAST_RULES: ContrastRule[] = [
  ...['ink', 'ink-muted'].map(role => ({ role, surfaces: SURFACES, min: TEXT_MIN })),
  ...SOFT_TEXT.map(role => ({ role, surfaces: [...SURFACES, `${role}-soft`], min: TEXT_MIN })),
  { role: 'on-ink', surfaces: ['ink'], min: TEXT_MIN },
  { role: 'on-accent', surfaces: ['accent', 'accent-hover'], min: TEXT_MIN },
  ...['line-strong', 'focus'].map(role => ({ role, surfaces: SURFACES, min: CONTROL_MIN })),
  ...['code-ink', 'code-muted', 'code-keyword', 'code-string', 'code-number', 'code-function'].map(role => ({ role, surfaces: ['surface-sunken'], min: TEXT_MIN })),
  // Contract 2.1 (#731): a theme that declares an older contract keeps validating
  ...['ink', 'ink-muted', 'link'].map(role => ({ role, surfaces: TONE_SURFACES, min: TEXT_MIN, since: '2.1' })),
]
