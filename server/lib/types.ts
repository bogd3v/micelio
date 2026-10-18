/** What a call to Strapi needs: the pure part of `strapiFetch`, usable outside Nitro (build modules). */
export interface StrapiRequestConfig {
  strapiUrl: string
  strapiApiToken?: string
}

/** A category as `loadCategories` serves it: the CMS values of one locale, with the published articles in it. */
export interface LoadedCategory {
  id: number
  slug: string
  name: string
  description: string | null
  /** The editor's position (non-localized in the CMS); null when none was set. */
  order: number | null
  /** Whether the home page highlights it: the CMS `featured`, else `pillar`. */
  featured: boolean
  /** Published articles of the requested locale. */
  count: number
}
