import type { PostListItem } from './strapi-post'

/**
 * How the blog list lays out its posts: as cards in a grid, or as a log grouped by month.
 *
 * @public
 */
export type BlogView = 'grid' | 'log'

/**
 * The order of the blog list: newest or oldest first, or by fediverse interactions (only when the fediverse module is on).
 *
 * @public
 */
export type BlogSort = 'recent' | 'oldest' | 'fediverse'

/**
 * The filters of the blog list, as the URL query carries them.
 *
 * @public
 */
export interface BlogFilters {
  category?: string
  tag?: string
  search?: string
  page: number
  view?: BlogView
  sort?: BlogSort
  /** Searches the article bodies as well as the titles. */
  content?: boolean
}

/**
 * The posts of one month in the log view.
 *
 * @public
 */
export interface PostMonth {
  /** The month as `YYYY-MM`, in the site's time zone (`timezone` of the site settings). */
  key: string
  /** The month's name in the page's locale. */
  label: string
  posts: PostListItem[]
}

/**
 * A page number, or `'gap'` where the pagination shows an ellipsis.
 *
 * @public
 */
export type PaginationItem = number | 'gap'

/**
 * A heading of an article's table of contents, with the `id` it links to.
 *
 * @public
 */
export interface TocHeading {
  id: string
  text: string
  /** Only the second and third heading levels appear in the table of contents. */
  level: 2 | 3
}

/**
 * A post of a reading path.
 *
 * @public
 */
export interface ReadingPathStep {
  /** Strapi's document id, which stays the same across locales. */
  documentId: string
  slug: string
  title: string | null
}

/**
 * The reading path of a category: up to 50 posts in reading order.
 *
 * @public
 */
export interface ReadingPath {
  category: string
  /** True when the steps follow the editors' `pathOrder`; false when they are the category's posts by date. */
  editorial: boolean
  steps: ReadingPathStep[]
}
