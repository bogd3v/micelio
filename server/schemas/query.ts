import { z } from 'zod'
import { Locale } from '~/interfaces/locale'
import { isContentSearch } from '~/helpers/search'
import { parseSort } from '~/helpers/blog'

/** The largest page size of the list routes: a larger `pageSize` is clamped to it. */
export const MAX_PAGE_SIZE = 50
/** The page size of `GET /api/posts` when the request names none. */
export const DEFAULT_PAGE_SIZE = 10
/** The longest search text the query schemas accept; a longer one is a 400 `Search is too long`. */
export const MAX_SEARCH_LENGTH = 200

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/
// The alphabet of a Strapi uid, which does not lower-case what an editor types, and a length of 256 at most
const POST_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.~-]{0,255}$/
const COMMENT_SORT_PATTERN = /^[a-zA-Z]+:(asc|desc)$/
const INVALID_PAGINATION = 'Invalid pagination'

function blank(value: unknown): unknown {
  return value === '' ? undefined : value
}

function lowerTrimmed(value: unknown): unknown {
  return typeof value === 'string' ? blank(value.trim().toLowerCase()) : value
}

const locale = z.preprocess(blank, z.enum(Object.values(Locale) as [Locale, ...Locale[]], { error: 'Unsupported locale' }).optional())
const slug = z.preprocess(lowerTrimmed, z.string({ error: 'Invalid slug' }).regex(SLUG_PATTERN, 'Invalid slug').optional())
const searchText = z.preprocess(blank, z.string({ error: 'Invalid search' }).trim().max(MAX_SEARCH_LENGTH, 'Search is too long').optional())
const content = z.unknown().optional().transform(isContentSearch)
const positiveInteger = z.string({ error: INVALID_PAGINATION })
  .regex(/^\d+$/, INVALID_PAGINATION)
  .transform(Number)
  .pipe(z.number().int().min(1, INVALID_PAGINATION).max(Number.MAX_SAFE_INTEGER, INVALID_PAGINATION))
const page = z.preprocess(blank, positiveInteger.optional())
const pageSize = z.preprocess(blank, positiveInteger.optional())

/** The route parameters of `GET /api/posts/:slug`: a `slug` in the alphabet and length of a Strapi uid, checked before any CMS call. A slug that fails it is a 400 `Invalid slug`. */
export const postParamsSchema = z.object({
  slug: z.string({ error: 'Invalid slug' }).regex(POST_SLUG_PATTERN, 'Invalid slug'),
})

/** The optional `locale` query of a route that answers in one language (`about`, `pages/:slug`, `posts/:slug`). An absent or empty value is accepted; an unsupported one is a 400 `Unsupported locale`. */
export const localeQuerySchema = z.object({ locale })

/** Like `localeQuerySchema`, but an absent or empty locale becomes English. Used by `categories`, `site` and `tags`. */
export const listLocaleQuerySchema = z.object({
  locale: locale.transform(value => value ?? Locale.English),
})

/**
 * The query of `GET /api/posts`: paging, locale, the category and tag slugs, a search text, the sort and the content-search flag.
 *
 * @remarks
 * `page` is a positive integer, default 1. `pageSize` defaults to `DEFAULT_PAGE_SIZE` and is clamped to `MAX_PAGE_SIZE`. A `page` or `pageSize` that is not a positive integer is a 400 `Invalid pagination`. A `category` or `tag` that is not a slug is a 400 `Invalid slug`. `sort` takes `oldest` or `fediverse` and falls back to `recent`; `content` is read by `isContentSearch`.
 */
export const postsQuerySchema = z.object({
  page: page.transform(value => value ?? 1),
  pageSize: pageSize.transform(value => Math.min(value ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)),
  locale,
  category: slug,
  tag: slug,
  search: searchText,
  sort: z.unknown().optional().transform(value => parseSort(value) ?? 'recent'),
  content,
})

/** The query of `GET /api/search`: the search text `q`, trimmed and empty when absent, the locale and the content-search flag. */
export const searchQuerySchema = z.object({
  q: searchText.transform(value => value ?? ''),
  locale,
  content,
})

/** The query of `GET /api/reading-path`: a category slug, trimmed and lowercased, of the shape of a slug (a 400 `Unknown category` otherwise; the route checks that the CMS has it, ADR 0016), and an optional locale. */
export const readingPathQuerySchema = z.object({
  category: z.preprocess(lowerTrimmed, z.string({ error: 'Unknown category' }).regex(SLUG_PATTERN, 'Unknown category')),
  locale,
})

/**
 * The query of `GET /api/comments` and `GET /api/comments/flat`: the locale, paging and a sort.
 *
 * @remarks
 * `page` is a positive integer. `pageSize` is clamped to `MAX_PAGE_SIZE` and has no default of its own, so the CMS default applies. `sort` is `field:asc` or `field:desc`; anything else is a 400 `Invalid sort`. The `relation` query is read by `commentRelation`, not here.
 */
export const commentsQuerySchema = z.object({
  locale,
  page,
  pageSize: pageSize.transform(value => (value === undefined ? undefined : Math.min(value, MAX_PAGE_SIZE))),
  sort: z.preprocess(blank, z.string({ error: 'Invalid sort' }).regex(COMMENT_SORT_PATTERN, 'Invalid sort').optional()),
})
