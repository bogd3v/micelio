import type { Page, PageSection } from './page'
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

/**
 * The article draft as its route answers: `DraftArticleResponse` and where each Playground block was among the CMS's blocks.
 *
 * @remarks
 * Not a slot API: `playgroundPositions` is for the preview's `micelio:run` (ADR 0019, section 4) and no theme reads it.
 */
export interface DraftArticleRunResponse extends DraftArticleResponse {
  /** The place of each Playground block of `article.blocks`, in their order, among the blocks the CMS sent, counting those the route dropped: the `index` of `micelio:run`. */
  playgroundPositions?: number[]
}

/**
 * A Playground block among the sections of a page draft (`shared.playground`), with what the preview runs and nothing else.
 *
 * @remarks
 * Only the draft route keeps it: `SectionRenderer` does not render it (it is not in `PAGE_SECTION_COMPONENTS`) and the public page route drops it. It is there so `micelio:run` finds the block by its position (ADR 0019, amendment of 2026-11-06).
 */
export interface DraftPlaygroundSection {
  __component: 'shared.playground'
  /** The language of `code`: `python`, `sql` or `javascript` can run. */
  runtime: string
  /** Plain text, as saved. */
  code: string
  /** Hidden code that runs before `code`; absent when there is none. */
  setup?: string
  /** The block's place in the zone as the CMS sent it, counting the sections the route dropped, which is the `index` of `micelio:run` (ADR 0019, section 4). */
  position: number
}

/** A section of a page draft: one the page renders, or a Playground block the preview can run. */
export type DraftPageSection = PageSection | DraftPlaygroundSection

/** A page as its draft route returns it: the page's sections and the Playground blocks among them, in the CMS's order. */
export interface DraftPage extends Omit<Page, 'sections'> {
  sections: DraftPageSection[]
}

/** A page draft for the preview page. */
export interface DraftPageResponse {
  page: DraftPage
  /** The `updatedAt` of the draft, which names the version the preview frame shows; null when the CMS sent none. */
  updatedAt: string | null
  /** Present when the request came with a preview grant, which is what lets the admin frame the draft. */
  preview?: DraftPreview
}
