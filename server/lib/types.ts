/** What a call to Strapi needs: the pure part of `strapiFetch`, usable outside Nitro (build modules). */
export interface StrapiRequestConfig {
  strapiUrl: string
  strapiApiToken?: string
}
