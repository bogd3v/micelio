import { z } from 'zod'
import type { BLOCK_EXPOSES, BlockOptionName, BlockOptionValue, OptionBlockUid } from '~/interfaces/block-options'
import { exposedOptions, optionValues, parseOption } from '~/helpers/blockOptions'

/** The zod fields of the presentation options a block exposes. */
export type OptionShape<U extends OptionBlockUid> = { [N in typeof BLOCK_EXPOSES[U][number]]: z.ZodOptional<z.ZodType<BlockOptionValue<N>>> }

/**
 * The fields of a block's presentation options as the routes send them: each an optional member of the values the block offers.
 *
 * @param uid - The component UID of the block (`section.hero`).
 */
export function optionResponseShape<U extends OptionBlockUid>(uid: U): OptionShape<U> {
  const entries = exposedOptions(uid).map(name => [name, z.enum(optionValues(uid, name) as [string, ...string[]]).optional()])
  return Object.fromEntries(entries) as unknown as OptionShape<U>
}

/**
 * The fields of a block's presentation options as the CMS stores them: a value the block does not offer drops itself alone, so a
 * block never fails to render because of an option, and a number is read as its string (`3` is `"3"`).
 *
 * @param uid - The component UID of the block (`section.hero`).
 */
export function optionInputShape<U extends OptionBlockUid>(uid: U): OptionShape<U> {
  const entries = exposedOptions(uid).map((name: BlockOptionName) => [name, z.unknown().transform(raw => parseOption(uid, name, raw)).optional()])
  return Object.fromEntries(entries) as unknown as OptionShape<U>
}
