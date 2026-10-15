/**
 * A social share override of a Strapi SEO component; the frontend does not read it.
 *
 * @public
 */
export interface StrapiMetaSocial {
  id: number
  socialNetwork: 'Facebook' | 'Twitter'
  title: string
  description: string
  /** The image, in the nested Strapi v4 shape. */
  image?: {
    data: {
      attributes: {
        url: string
        alternativeText?: string | null
      }
    }
  }
}

/**
 * The SEO component of a Strapi entry (`shared.seo`), as the CMS stores it.
 *
 * @public
 */
export interface StrapiSEO {
  id: number
  metaTitle: string
  metaDescription: string
  /**
   * The share image. `url` is the flat Strapi field; `data.attributes.url` is the older nested shape,
   * which the pages read when `url` is missing.
   */
  metaImage?: {
    url?: string
    alternativeText?: string | null
    data?: {
      attributes: {
        url: string
        alternativeText?: string | null
        width?: number
        height?: number
      }
    }
  } | null
  /** Share overrides per network; the frontend does not read them. */
  metaSocial?: StrapiMetaSocial[]
  keywords?: string | null
  metaRobots?: string | null
  /** JSON-LD for the article page; when set it replaces the generated `BlogPosting` graph. `null` when empty. */
  structuredData?: Record<string, unknown> | unknown[] | null
  /** The viewport meta value; the frontend does not read it. */
  metaViewport?: string | null
  canonicalURL?: string | null
}
