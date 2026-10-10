/**
 * The kind of a reference, as the CMS enumeration.
 *
 * @remarks
 * `journal`, `conference` and `chapter` italicize their container in the APA line.
 *
 * @public
 */
export type StrapiReferenceType
  = | 'journal'
    | 'conference'
    | 'preprint'
    | 'book'
    | 'chapter'
    | 'web'
    | 'software'
    | 'docs'

/**
 * A reference of an article, as the CMS stores it.
 *
 * @public
 */
export interface StrapiReference {
  id?: number
  /** The key the article cites it by: lowercase letters, digits and hyphens. */
  key: string
  type: StrapiReferenceType
  /** The authors as one text. */
  authors: string
  /** The year as text. */
  year: string
  title: string
  container?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  /** Venue shown in capitals in place of the container and the year. */
  venueLabel?: string | null
  /** The DOI without the resolver prefix; it takes precedence over `url`. */
  doi?: string | null
  url?: string | null
  /** The date the source was accessed, `YYYY-MM-DD`, shown with the reference note; the latest of an article's dates is shown with the reference list. */
  accessedAt?: string | null
}

/**
 * A reference with its place in the numbered list of an article.
 *
 * @remarks
 * Cited references come first, in the order of their first citation, then the uncited ones.
 *
 * @public
 */
export interface NumberedReference {
  /** The 1-based position in the list. */
  number: number
  cited: boolean
  reference: StrapiReference
}

/**
 * The citation numbers and anchors that one block needs when it is rendered.
 *
 * @public
 */
export interface BlockCitations {
  /** The number of each cited reference key, for the whole article. */
  numbers: Readonly<Record<string, number>>
  /** The reference keys first cited in this block; their target anchor is emitted here. */
  anchored: readonly string[]
}

/**
 * The citation numbers of a whole article and the anchors that each block carries.
 *
 * @public
 */
export interface CitationIndex {
  /** The number of each cited reference key, from 1. */
  numbers: Readonly<Record<string, number>>
  /** The block key (its `__component` and `id`) to the reference keys first cited in that block. */
  anchors: Readonly<Record<string, string[]>>
}

/**
 * What a segment of a formatted reference line is: plain text, a link to the title, or the container in italics.
 *
 * @public
 */
export type ApaSegmentKind = 'text' | 'title' | 'container'

/**
 * A piece of a formatted reference line.
 *
 * @public
 */
export interface ApaSegment {
  kind: ApaSegmentKind
  text: string
  /** The link target; only a title segment with a link has one. */
  href?: string
}

/**
 * The DOI or URL of a reference, as shown and as linked.
 *
 * @public
 */
export interface ReferenceIdentifier {
  /** The shown text, such as `doi.org/...` or `arXiv:...`. */
  text: string
  href: string
}
