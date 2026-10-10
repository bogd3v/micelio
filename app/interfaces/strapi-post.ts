import type { StrapiBlock, StrapiImageCredit } from './strapi-blocks'
import type { StrapiSEO } from './strapi-seo'
import type { StrapiReference } from './strapi-reference'
import type { Locale } from './locale'

/**
 * An image of an article, a category or an author, as the article queries populate it.
 *
 * @public
 */
export interface StrapiMediaRef {
  id?: number
  documentId?: string
  /** A `/uploads/` path or an absolute URL; `getMediaUrl` makes a path absolute. */
  url: string
  alternativeText?: string | null
  width?: number
  height?: number
}

/**
 * The category of an article, as the article queries populate it.
 *
 * @public
 */
export interface StrapiCategoryRef {
  id?: number
  documentId?: string
  name?: string
  slug?: string | null
}

/**
 * A tag of an article, populated with its name and slug only.
 *
 * @public
 */
export interface StrapiTagRef {
  id?: number
  documentId?: string
  name: string
  slug: string
}

/**
 * A tag with the number of its articles in one locale, as the `/api/tags` route returns it.
 *
 * @public
 */
export interface TagCount {
  slug: string
  name: string
  /** Articles with the tag in the requested locale; tags with none are left out. */
  count: number
}

/**
 * The same article in another locale, as the localizations of an article populate it.
 *
 * @public
 */
export interface StrapiLocalization {
  id?: number
  documentId?: string
  slug: string
  locale: string
  /** Null while the translation is a draft; such translations are left out. */
  publishedAt?: string | null
}

/**
 * The version of an article or a page in another locale, for language switches and hreflang.
 *
 * @public
 */
export interface PostTranslation {
  locale: Locale
  slug: string
}

/**
 * The author of an article, as the article queries populate it.
 *
 * @public
 */
export interface StrapiAuthorRef {
  id?: number
  documentId?: string
  name?: string
  avatar?: StrapiMediaRef | null
}

/**
 * An article as Strapi returns it, before `toStrapiPost` turns it into a `StrapiPost`.
 *
 * @public
 */
export interface RawStrapiArticle {
  id: number
  documentId: string
  title: string
  slug: string
  description?: string | null
  content?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  createdAt?: string | null
  locale?: string | null
  readTime?: number | null
  tags?: StrapiTagRef[] | null
  cover?: StrapiMediaRef | null
  coverCredit?: StrapiImageCredit | null
  category?: StrapiCategoryRef | null
  author?: StrapiAuthorRef | null
  seo?: StrapiSEO | null
  snippet?: string | null
  blocks?: StrapiBlock[] | null
  references?: StrapiReference[] | null
  localizations?: StrapiLocalization[] | null
}

/**
 * An article as a list card shows it, populated with `POST_CARD_POPULATE`.
 *
 * @public
 */
export interface PostListItem {
  id: number
  documentId?: string
  title: string
  slug: string
  description?: string | null
  publishedAt?: string | null
  readTime?: number | null
  tags?: StrapiTagRef[] | null
  cover?: StrapiMediaRef | null
  category?: StrapiCategoryRef | null
  author?: StrapiAuthorRef | null
  seo?: StrapiSEO | null
  snippet?: string | null
}

/**
 * The field of an article that a search matched.
 *
 * @public
 */
export type SearchMatch = 'title' | 'description' | 'content'

/**
 * One hit of the search route, `/api/search`.
 *
 * @public
 */
export interface SearchPostResult {
  documentId: string
  title: string
  slug: string
  description: string | null
  publishedAt: string | null
  category: { name: string | null, slug: string | null } | null
  /** The field that matched; `title` when the server does not recognize the value. */
  matchedIn: SearchMatch
  /** An excerpt around the match; empty when there is none. */
  snippet: string
}

/**
 * A full article as the frontend renders it, with its body, references and published translations.
 *
 * @public
 */
export interface StrapiPost {
  id: number
  documentId: string
  title: string
  slug: string
  description?: string | null
  content?: string | null
  publishedAt?: string | null
  readTime?: number | null
  tags?: StrapiTagRef[] | null
  cover?: StrapiMediaRef | null
  coverCredit?: StrapiImageCredit | null
  category?: StrapiCategoryRef | null
  author?: StrapiAuthorRef | null
  seo?: StrapiSEO
  blocks: StrapiBlock[]
  /** The references of the article; empty when it has none. */
  references: StrapiReference[]
  /** The published versions in other locales; empty when there are none. */
  translations: PostTranslation[]
}
