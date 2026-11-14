// Where the presentation options vocabulary (`~/interfaces`, `BLOCK_OPTIONS`) is narrower than its values. Declarations only.

/** The blocks of an article, where `width: full` is refused. */
export const ARTICLE_BLOCK_UIDS: readonly string[] = ['shared.quote', 'shared.media', 'shared.slider', 'shared.playground']

/** The only block that offers `columns: 6`. */
export const SIX_COLUMNS_BLOCK = 'section.logo-cloud'

/**
 * The names of the options vocabulary that the theme contract does not render yet: no `data-<name>` hook, no core rule, and no block offers them (ADR-0018, section 1).
 *
 * @remarks
 * The generated hooks reference and the theme contract tests of `test/blockOptions.test.ts` skip them; a name leaves the list when the theme contract renders it.
 */
export const UNRENDERED_OPTION_NAMES: readonly string[] = ['iconStyle']
