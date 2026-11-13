// The instance ids the CMS gives (micelio-cms `block-ids` migration, the plugin's document service middleware): `blockId` on every
// block of `page.sections` and `article.blocks`, `itemId` on every repeatable item. The mocks write them as `<scope>-b<n>` and
// `<scope>-b<n>-i<m>`, unique in their zone and block, with the position the block has in the list as it is written here.

/** The component of each block with repeatable items, and the field that holds them. */
export const ITEM_FIELDS = {
  'section.feature-grid': 'items',
  'section.stats': 'items',
  'section.logo-cloud': 'logos',
  'section.testimonials': 'items',
  'section.pricing': 'plans',
  'section.faq': 'items',
  'shared.slider': 'items',
}

/**
 * Gives each block of a dynamic zone a `blockId`, and each repeatable item of it an `itemId`, where it has none; the blocks it returns are copies.
 *
 * @param {object[]} blocks The blocks of one zone, `section.*` or `shared.*`.
 * @param {string} scope Names the zone in its ids, so two zones never share one.
 */
export function withIds(blocks, scope) {
  return blocks.map((block, index) => {
    const blockId = block.blockId ?? `${scope}-b${index + 1}`
    const field = ITEM_FIELDS[block.__component]
    const items = field && Array.isArray(block[field]) ? block[field].map((item, at) => ({ ...item, itemId: item.itemId ?? `${blockId}-i${at + 1}` })) : undefined
    return { ...block, blockId, ...(items && { [field]: items }) }
  })
}
