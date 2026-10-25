import type { Page } from './page'
import type { DraftPreview } from './preview'
import type { RawStrapiArticle } from './strapi-post'

/**
 * Whether a draft has never been published, or differs from its published version.
 *
 * @public
 */
export type DraftState = 'never-published' | 'modified'

/**
 * The state a draft view shows: a `DraftState`, or `unchanged` when the draft matches its published version.
 *
 * @public
 */
export type DraftViewState = DraftState | 'unchanged'

/**
 * The filter of the drafts list: all drafts, or the drafts in one state.
 *
 * @public
 */
export type DraftFilter = 'all' | DraftState

/**
 * A draft in the drafts list.
 *
 * @public
 */
export interface DraftListItem {
  /** Strapi's document id, stable across locales. */
  documentId: string
  title: string
  slug: string | null
  locale: string
  updatedAt: string
  /** Null when the article was never published. */
  publishedAt: string | null
  state: DraftState
  category: { name?: string | null, slug?: string | null } | null
  author: { name?: string | null } | null
}

/**
 * The drafts list with its total count.
 *
 * @public
 */
export interface DraftListResponse {
  data: DraftListItem[]
  meta: { count: number }
}

/**
 * The published version of a draft, when there is one: its slug and its dates.
 *
 * @public
 */
export interface PublishedVersion {
  slug: string
  updatedAt: string | null
  publishedAt: string | null
}

/**
 * A draft for the preview page, with its published version when it has one.
 *
 * @public
 */
export interface DraftArticleResponse {
  article: RawStrapiArticle
  /** Null when the article has no published version, and always null when the request came with a preview grant. */
  published: PublishedVersion | null
  /** Present when the request came with a preview grant, which is what lets the admin frame the draft. */
  preview?: DraftPreview
}

/** A page draft for the preview page. */
export interface DraftPageResponse {
  page: Page
  /** The `updatedAt` of the draft, which names the version the preview frame shows; null when the CMS sent none. */
  updatedAt: string | null
  /** Present when the request came with a preview grant, which is what lets the admin frame the draft. */
  preview?: DraftPreview
}
