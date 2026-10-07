import type { LocationQuery, RouteParams } from 'vue-router'
import type { BlogFilters, BlogSort, BlogView, PaginationItem, PostMonth } from '../interfaces/blog'
import type { PostListItem } from '../interfaces/strapi-post'
import { isCategory } from './categories'
import { MIN_SEARCH_LENGTH, isContentSearch } from './search'

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

const LEGACY_BLOG_PATH = /^(\/es)?\/blog\/?$/
const FIRST_PAGE_PATH = /^((?:\/es)?\/blog(?:\/(?:category|tag)\/[^/]+)?)\/page\/0*1$/
const LEGACY_PARAMS = ['category', 'tag', 'page']

/** The new URL for an old query-string filter URL (`/blog?category=x&page=2`) or a `/page/1` path; null when it needs none. */
export function legacyBlogRedirect(pathname: string, search: string): string | null {
  const firstPage = FIRST_PAGE_PATH.exec(pathname)
  if (firstPage) return search.replace(/^\?/, '') ? `${firstPage[1]}?${search.replace(/^\?/, '')}` : firstPage[1]!
  const match = LEGACY_BLOG_PATH.exec(pathname)
  if (!match) return null
  const params = new URLSearchParams(search)
  if (!LEGACY_PARAMS.some(name => params.has(name))) return null
  const category = (params.get('category') ?? '').trim().toLowerCase()
  const page = Number.parseInt(params.get('page') ?? '', 10)
  const location = blogPath({
    category: isCategory(category) ? category : undefined,
    tag: (params.get('tag') ?? '').trim() || undefined,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  }, `${match[1] ?? ''}${BLOG_BASE}`)
  const rest = new URLSearchParams()
  for (const [name, value] of params) if (!LEGACY_PARAMS.includes(name)) rest.append(name, value)
  const query = rest.toString()
  return query ? `${location}?${query}` : location
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
