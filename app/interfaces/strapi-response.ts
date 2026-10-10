/**
 * The pagination of a Strapi list response.
 *
 * @public
 */
export interface PaginationMeta {
  /** The current page, from 1. */
  page: number
  pageSize: number
  pageCount: number
  total: number
}

/**
 * A Strapi REST response: its data and the pagination when the response is a list.
 *
 * @public
 */
export interface StrapiResponse<T> {
  data: T
  meta: {
    pagination?: PaginationMeta
  }
}

/**
 * A Strapi list response, which always carries its pagination.
 *
 * @public
 */
export interface StrapiPaginatedResponse<T> extends StrapiResponse<T> {
  meta: {
    pagination: PaginationMeta
  }
}
