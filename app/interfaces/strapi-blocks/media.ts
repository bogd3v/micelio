/**
 * A Strapi upload, as an image block, a slide or a file of a slider carries it.
 *
 * @public
 */
export interface StrapiMediaFile {
  /** A `/uploads/` path or an absolute URL; `getMediaUrl` makes a path absolute. */
  url: string
  alternativeText?: string
  /** The caption of the upload, used when the block has none of its own. */
  caption?: string
  width?: number
  height?: number
}

/**
 * What an image is, for its credit line: a photo, an illustration, a diagram or a screenshot.
 *
 * @public
 */
export type StrapiImageCreditKind = 'photo' | 'illustration' | 'diagram' | 'screenshot'

/**
 * The licence of an image, as the CMS enumeration.
 *
 * @remarks
 * `cc0`, the Creative Commons licences and `unsplash` link to their licence page; the other values
 * link to `licenseUrl`, and `own-work` has no link.
 *
 * @public
 */
export type StrapiImageLicense
  = | 'own-work'
    | 'cc0'
    | 'public-domain'
    | 'cc-by-4.0'
    | 'cc-by-sa-4.0'
    | 'cc-by-nc-4.0'
    | 'unsplash'
    | 'permission'
    | 'other'

/**
 * The credit line of an image: who made it, where it comes from and under which licence.
 *
 * @public
 */
export interface StrapiImageCredit {
  id?: number
  kind: StrapiImageCreditKind
  author?: string | null
  authorUrl?: string | null
  source?: string | null
  sourceUrl?: string | null
  license: StrapiImageLicense
  /** Link to the licence text, for a licence without a fixed page. */
  licenseUrl?: string | null
  /** What was changed in the image, shown with the credit. */
  modifications?: string | null
}

/**
 * An image block of an article, `shared.media`.
 *
 * @public
 */
export interface StrapiMedia {
  id: number
  __component: 'shared.media'
  file: StrapiMediaFile
  /** The caption under the image; the file's own caption is the fallback. */
  caption?: string | null
  credit?: StrapiImageCredit | null
}

/**
 * One slide of a `StrapiSlider`, `shared.slide`.
 *
 * @public
 */
export interface StrapiSlide {
  id?: number
  file: StrapiMediaFile
  caption?: string | null
  credit?: StrapiImageCredit | null
}

/**
 * A slider block of an article, `shared.slider`.
 *
 * @public
 */
export interface StrapiSlider {
  id: number
  __component: 'shared.slider'
  /** The slides, each with its own caption and credit. */
  items?: StrapiSlide[] | null
  /** Plain uploads, used when `items` is empty; their captions come from the files. */
  files?: StrapiMediaFile[] | null
}
