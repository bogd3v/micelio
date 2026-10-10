import type { TocHeading } from '../interfaces/blog'
import type { StrapiBlock, StrapiRichText } from '../interfaces/strapi-blocks'
import { slugify } from './slugify'

const HEADING = /^(#{2,3}) (.+)$/

function isRichText(block: StrapiBlock): block is StrapiRichText {
  return block.__component === 'shared.rich-text'
}

/**
 * The `##` and `###` headings of the rich-text blocks, as table-of-contents entries.
 *
 * @remarks
 * `id` is `slugify()` of the heading text. Other blocks are ignored, and
 * `null` or `undefined` gives an empty array.
 */
export function extractHeadings(blocks: StrapiBlock[] | null | undefined): TocHeading[] {
  const headings: TocHeading[] = []
  for (const block of blocks ?? []) {
    if (!isRichText(block) || !block.body) continue
    for (const line of block.body.split('\n')) {
      const match = HEADING.exec(line.trim())
      if (!match) continue
      const text = match[2]!.trim()
      headings.push({ id: slugify(text), text, level: match[1]!.length === 2 ? 2 : 3 })
    }
  }
  return headings
}
