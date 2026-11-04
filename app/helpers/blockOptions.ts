import { ARTICLE_BLOCK_UIDS, SIX_COLUMNS_BLOCK } from '../constants/block-options'
import { BLOCK_EXPOSES, BLOCK_OPTIONS, BLOCK_OPTION_NAMES } from '../interfaces/block-options'
import type { BlockOptionName, OptionAttributes, OptionBlockUid } from '../interfaces/block-options'

/** The options a block exposes, in the vocabulary's order; none for a component that is not in the catalogue. */
export function exposedOptions(uid: string): readonly BlockOptionName[] {
  return Object.hasOwn(BLOCK_EXPOSES, uid) ? BLOCK_EXPOSES[uid as OptionBlockUid] : []
}

/** The values a block offers for an option: the vocabulary's, less `width: full` on an article block and `columns: 6` on all but `logo-cloud`. */
export function optionValues(uid: string, name: BlockOptionName): readonly string[] {
  return BLOCK_OPTIONS[name].values.filter((value) => {
    if (name === 'width') return !(value === 'full' && ARTICLE_BLOCK_UIDS.includes(uid))
    if (name === 'columns') return value !== '6' || uid === SIX_COLUMNS_BLOCK
    return true
  })
}

/** Reads a stored option: a number or a string that is one of the block's values, otherwise `undefined` (the block's own look). */
export function parseOption(uid: string, name: BlockOptionName, raw: unknown): string | undefined {
  if (!exposedOptions(uid).includes(name)) return undefined
  const value = typeof raw === 'number' ? String(raw) : raw
  return typeof value === 'string' && optionValues(uid, name).includes(value) ? value : undefined
}

/**
 * The `data-*` attributes that write a block's options on its root hook, for `v-bind` in a template.
 *
 * @remarks
 * The server has already kept only the options the block exposes and the values it offers (`parsePage`, `publicArticle`, `publicAbout`),
 * so this copies the strings it finds: the core's CSS has no rule for the default value, so it looks like an absent attribute, and a
 * theme that does not style a value renders the core's look, not the first value of the list. It is all the browser carries of the vocabulary.
 *
 * @param block - The block as the server sent it; only the option fields are read.
 */
export function optionAttributes<B extends { __component: string }>(block: B): OptionAttributes {
  const attributes: OptionAttributes = {}
  for (const name of BLOCK_OPTION_NAMES) {
    const value = (block as Record<string, unknown>)[name]
    if (typeof value === 'string') attributes[`data-${name}`] = value
  }
  return attributes
}
