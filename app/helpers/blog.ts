import type { LocationQuery, RouteParams } from 'vue-router'
import type { BlogFilters, BlogSort, BlogView, PaginationItem, PostMonth } from '../interfaces/blog'
import type { PostListItem } from '../interfaces/strapi-post'
import { defaultLocale, Locale } from '../interfaces/locale'
import { isCategory } from './categories'
import { isContentSearch } from './search'
import { MIN_SEARCH_LENGTH } from '../constants/search'

/**
 * Articles per page of the blog list.
 *
 * @internal Exported for tests.
 */
export const BLOG_PAGE_SIZE = 6
export const LOG_PAGE_SIZE = 24
const BLOG_BASE = '/blog'

const LOG_VIEW = 'log'
export const BLOG_SORTS: BlogSort[] = ['recent', 'oldest', 'fediverse']
const TIME_ZONE = 'America/Bogota'

function firstValue(value: LocationQuery[string] | RouteParams[string] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw.trim() : ''
}

export function searchTerm(input: string): string | undefined {
  const term = input.trim()
  return term.length >= MIN_SEARCH_LENGTH ? term : undefined
}

export function parseBlogRoute(params: RouteParams, query: LocationQuery): BlogFilters {
  const category = firstValue(params.category).toLowerCase()
  const tag = firstValue(params.tag)
  const page = Number.parseInt(firstValue(params.page), 10)
  return {
    // A path carries one filter: the category wins over the tag
    category: isCategory(category) ? category : undefined,
    tag: isCategory(category) ? undefined : tag || undefined,
    search: searchTerm(firstValue(query.search)),
    page: Number.isFinite(page) && page > 1 ? page : 1,
    view: parseView(firstValue(query.view)),
    sort: parseSort(firstValue(query.sort)),
    content: isContentSearch(query.content) || undefined,
  }
}

export function parseSort(value: unknown): BlogSort | undefined {
  const sort = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return sort === 'oldest' || sort === 'fediverse' ? sort : undefined
}

function parseView(value: string): BlogView | undefined {
  return value.toLowerCase() === LOG_VIEW ? 'log' : undefined
}

export function blogPageSize(view: BlogView | undefined): number {
  return view === 'log' ? LOG_PAGE_SIZE : BLOG_PAGE_SIZE
}

/** The filters that stay in the query string: search, view, sort and content. */
export function blogQuery(filters: BlogFilters): Record<string, string> {
  const query: Record<string, string> = {}
  if (filters.search) query.search = filters.search
  if (filters.view === 'log') query.view = LOG_VIEW
  if (filters.sort && filters.sort !== 'recent') query.sort = filters.sort
  if (filters.content) query.content = '1'
  return query
}

/** `/blog`, `/blog/category/<slug>`, `/blog/tag/<slug>` and their `/page/<n>`; one filter per path, the category wins. */
export function blogPath(filters: Pick<BlogFilters, 'category' | 'tag' | 'page'>, base = BLOG_BASE): string {
  const filter = filters.category
    ? `/category/${encodeURIComponent(filters.category)}`
    : filters.tag ? `/tag/${encodeURIComponent(filters.tag)}` : ''
  return `${base}${filter}${filters.page > 1 ? `/page/${filters.page}` : ''}`
}

export function blogLocation(filters: BlogFilters, base = BLOG_BASE): { path: string, query: Record<string, string> } {
  return { path: blogPath(filters, base), query: blogQuery(filters) }
}

const LOCALE_PREFIXES = Object.values(Locale).filter(code => code !== defaultLocale).join('|')
const BLOG_URL_PATH = new RegExp(`^((?:/(?:${LOCALE_PREFIXES}))?${BLOG_BASE})(?:/(category|tag)/([^/]+))?(?:/page/(\\d+))?/?$`)
const LEGACY_PARAMS = ['category', 'tag', 'page']

/** Whether the path parameters of a blog list route name a real category and a page above the first. */
export function isBlogRouteValid(params: RouteParams): boolean {
  const category = firstValue(params.category)
  if (category && !isCategory(category.toLowerCase())) return false
  return params.page === undefined || Number.parseInt(firstValue(params.page), 10) >= 2
}

/**
 * The canonical URL for a blog list request, or null when it already is: old query-string filters
 * (`/blog?category=x&page=2`), a category in capitals, a padded page number or `/page/1`.
 */
export function legacyBlogRedirect(pathname: string, search: string): string | null {
  const match = BLOG_URL_PATH.exec(pathname)
  if (!match) return null
  const [, base = BLOG_BASE, kind, slug, pageText] = match
  const params = new URLSearchParams(search)
  const legacy = LEGACY_PARAMS.some(name => params.has(name))
  const queryFilters = legacy && !kind && !pageText
  const category = (kind === 'category' ? slug : queryFilters ? params.get('category') : '')?.trim().toLowerCase() ?? ''
  const tag = (kind === 'tag' ? slug : queryFilters ? params.get('tag') : '')?.trim() ?? ''
  const page = Number.parseInt(pageText ?? (queryFilters ? params.get('page') ?? '' : ''), 10)
  // An unknown category or page 0 in a path is a 404, not a redirect
  if (kind === 'category' && !isCategory(category)) return null
  if (pageText !== undefined && page < 1) return null
  const location = blogPath({
    category: isCategory(category) ? category : undefined,
    tag: isCategory(category) ? undefined : tag || undefined,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  }, base)
  const rest = new URLSearchParams()
  for (const [name, value] of params) if (!queryFilters || !LEGACY_PARAMS.includes(name)) rest.append(name, value)
  const query = rest.toString()
  const target = query ? `${location}?${query}` : location
  // Compare without the query: a canonical path is left alone
  return location === pathname && !queryFilters ? null : target
}

function monthKey(date: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: TIME_ZONE }).formatToParts(new Date(date))
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}`
}

function monthLabel(key: string, locale: string): string {
  const [year, month] = key.split('-').map(Number)
  const name = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year!, month! - 1, 15)))
  return `${name} ${year}`
}

export function groupPostsByMonth(posts: PostListItem[], locale: string): PostMonth[] {
  const months = new Map<string, PostListItem[]>()
  for (const post of posts) {
    if (!post.publishedAt) continue
    const key = monthKey(post.publishedAt)
    months.set(key, [...(months.get(key) ?? []), post])
  }
  return Array.from(months, ([key, items]) => ({ key, label: monthLabel(key, locale), posts: items }))
}

export function hasActiveFilters(filters: BlogFilters): boolean {
  return Boolean(filters.category || filters.tag || filters.search)
}

export function paginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const items: PaginationItem[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('gap')
  for (let page = start; page <= end; page++) items.push(page)
  if (end < total - 1) items.push('gap')
  items.push(total)
  return items
}
