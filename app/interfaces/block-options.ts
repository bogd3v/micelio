// The presentation options of the block contract: the nine names a block may expose and the closed set of values of each.
// The vocabulary is `contract/options.ts` of micelio-plugin-core (ADR-0018, section 1) and `docs/blocks.md` there; this is its
// copy for the theme contract (ADR-0005, section 11), compared in `test/blockOptions.test.ts` with a literal of the plugin's reference, which is not the plugin's file: a new value there needs this copy changed by hand.

/**
 * The vocabulary of presentation options: each name, its values in the order a theme and the editor list them, and its default.
 *
 * @remarks
 * Values are strings (`columns: 3` and `"3"` are the same value). Each name is also the public hook `data-<name>` of the theme
 * contract, from 2.1, and `docs/themes/reference/hooks.md` says what each value does. The default is what a block renders when
 * its content sets no value, and the core has no rule for it, so a stored default looks like an absent attribute. A theme that does not
 * style a value renders the core's look, not the first value of the list (`columns` lists `2` first and defaults to `3`).
 *
 * @public
 */
export const BLOCK_OPTIONS = {
  layout: { values: ['centered', 'split', 'stacked'], default: 'centered' },
  width: { values: ['prose', 'wide', 'full'], default: 'prose' },
  columns: { values: ['2', '3', '4', '6'], default: '3' },
  density: { values: ['comfortable', 'compact'], default: 'comfortable' },
  align: { values: ['start', 'center'], default: 'start' },
  tone: { values: ['default', 'raised', 'accent'], default: 'default' },
  ratio: { values: ['16:9', '4:3', '1:1', 'auto'], default: '16:9' },
  height: { values: ['s', 'm', 'l', 'full'], default: 'm' },
  iconStyle: { values: ['outline', 'filled'], default: 'outline' },
} as const

/**
 * The name of a presentation option of the vocabulary.
 *
 * @public
 */
export type BlockOptionName = keyof typeof BLOCK_OPTIONS

/**
 * The names of the vocabulary, in its order, as the `data-<name>` hooks.
 *
 * @remarks
 * Its own constant, because the browser needs the names and nothing else of the vocabulary: the server has already checked the values.
 *
 * @public
 */
export const BLOCK_OPTION_NAMES = ['layout', 'width', 'columns', 'density', 'align', 'tone', 'ratio', 'height', 'iconStyle'] as const satisfies readonly BlockOptionName[]

/**
 * The options each block exposes, by component UID (the `docs/blocks.md` reference of micelio-plugin-core).
 *
 * @remarks
 * `shared.rich-text` exposes none. Every page section offers `align` and `tone`; a `scene` only in its `inline` variant, which `micelio-plugin-core`
 * enforces (a `background` scene paints its own poster). A block offers all of an option's values, less `width: full` on the article blocks and `columns: 6`
 * on every block but `logo-cloud`.
 *
 * @public
 */
export const BLOCK_EXPOSES = {
  'section.hero': ['layout', 'align', 'tone', 'height'],
  'section.feature-grid': ['columns', 'density', 'align', 'tone'],
  'section.media-showcase': ['align', 'tone', 'ratio'],
  'section.stats': ['columns', 'align', 'tone'],
  'section.logo-cloud': ['columns', 'density', 'align', 'tone'],
  'section.testimonials': ['layout', 'density', 'align', 'tone'],
  'section.pricing': ['columns', 'align', 'tone'],
  'section.faq': ['density', 'align', 'tone'],
  'section.cta': ['layout', 'align', 'tone'],
  'section.post-list': ['density', 'align', 'tone'],
  'section.newsletter': ['align', 'tone'],
  'section.rich-text': ['width', 'align', 'tone'],
  'section.gallery': ['width', 'density', 'align', 'tone'],
  'section.scene': ['align', 'tone', 'height'],
  'shared.quote': ['width', 'align'],
  'shared.media': ['width', 'ratio'],
  'shared.slider': ['ratio'],
  'shared.playground': ['height'],
} as const satisfies Record<string, readonly BlockOptionName[]>

/**
 * The component UID of a block that exposes presentation options.
 *
 * @public
 */
export type OptionBlockUid = keyof typeof BLOCK_EXPOSES

/**
 * The value of an option, as the vocabulary writes it: `'3'`, `'centered'`.
 *
 * @public
 */
export type BlockOptionValue<N extends BlockOptionName> = typeof BLOCK_OPTIONS[N]['values'][number]

/**
 * The presentation options a block exposes, optional as the server sends them: an absent one is the block's own look.
 *
 * @public
 */
export type BlockOptions<U extends OptionBlockUid> = { [N in typeof BLOCK_EXPOSES[U][number]]?: BlockOptionValue<N> }

/** The `data-*` attributes of a block's presentation options, by attribute name. */
export type OptionAttributes = Partial<Record<`data-${BlockOptionName}`, string>>
