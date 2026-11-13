import type { BlockOptions } from '../block-options'
/**
 * A text block of an article written in Markdown, `shared.rich-text`.
 *
 * @public
 */
export interface StrapiRichText {
  id: number
  __component: 'shared.rich-text'
  /** The stable id of this block instance, opaque and unique in its zone; `null` or absent in content stored before the CMS generated ids. Renderers key by it and fall back to the position. */
  blockId?: string | null
  /** The Markdown as the CMS stores it, before rendering. */
  body: string | null
  /** The sanitized HTML of `body`; set on the server. */
  html?: string
}

/**
 * A quote block of an article, `shared.quote`, rendered as inline Markdown.
 *
 * @public
 */
export interface StrapiQuote extends BlockOptions<'shared.quote'> {
  id: number
  __component: 'shared.quote'
  /** The stable id of this block instance, opaque and unique in its zone; `null` or absent in content stored before the CMS generated ids. Renderers key by it and fall back to the position. */
  blockId?: string | null
  /** The quoted text in Markdown, as the CMS stores it. */
  body: string | null
  /** The sanitized HTML of `body`, rendered inline; set on the server. */
  html?: string
  /** The attribution shown after the quote. */
  title?: string | null
}

/**
 * The languages a playground block names: `python`, `sql` or `javascript`.
 *
 * @public
 */
export type StrapiPlaygroundRuntime = 'python' | 'sql' | 'javascript'

/**
 * A block of code with its expected output, `shared.playground`.
 *
 * @public
 */
export interface StrapiPlayground extends BlockOptions<'shared.playground'> {
  id: number
  __component: 'shared.playground'
  /** The stable id of this block instance, opaque and unique in its zone; `null` or absent in content stored before the CMS generated ids. Renderers key by it and fall back to the position. */
  blockId?: string | null
  /** The language of `code`; the block can run only for the runtimes the frontend knows. */
  runtime: StrapiPlaygroundRuntime | string
  /** Plain text, not Markdown. */
  code: string
  /** The output the code is expected to print, shown with the block. */
  expectedOutput?: string | null
  /** Hidden code that runs before `code`; never rendered */
  setup?: string | null
  caption?: string | null
}
