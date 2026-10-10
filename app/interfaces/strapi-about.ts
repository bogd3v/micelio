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
  title: string
  locale: string
  seo?: StrapiSEO
  /** The page body, in order; each block is discriminated by `__component`. */
  blocks: StrapiBlock[]
}
