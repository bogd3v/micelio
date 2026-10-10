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
        alternativeText?: string
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
        alternativeText?: string
        width?: number
        height?: number
      }
    }
  }
  /** Share overrides per network; the frontend does not read them. */
  metaSocial?: StrapiMetaSocial[]
  keywords?: string
  metaRobots?: string
  /** JSON-LD for the article page; when set it replaces the generated `BlogPosting` graph. */
  structuredData?: Record<string, unknown>
  /** The viewport meta value; the frontend does not read it. */
  metaViewport?: string
  canonicalURL?: string
}
