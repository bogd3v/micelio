import type { IconSymbolCarrier } from './icons'
import type { StrapiBlock } from './strapi-blocks'
import type { StrapiSEO } from './strapi-seo'

/**
 * The SEO component of the About page, the same shape as the SEO of an article.
 *
 * @public
 */
export type { StrapiSEO as StrapiAboutSEO }

/**
 * The About page of the CMS, with its body blocks, as Strapi returns it.
 *
 * @public
 */
export interface StrapiAbout {
  id: number
  documentId: string
  title: string | null
  locale: string
  seo?: StrapiSEO | null
  /** The page body, in order; each block is discriminated by `__component`. */
  blocks: StrapiBlock[]
}

/** The About page as `GET /api/about` sends it: the page, with the symbols of its icons when its blocks use some (ADR 0021). */
export interface StrapiAboutResponse extends StrapiAbout, IconSymbolCarrier {}
