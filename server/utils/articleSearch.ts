import type { H3Event } from 'h3'
import type { SearchMatch, SearchPostResult } from '~/interfaces'

const SEARCH_TIMEOUT_MS = 3000
const MATCHES = new Set<SearchMatch>(['title', 'description', 'content'])

export const SEARCH_MAX_RESULTS = 50

interface UpstreamSearchRow {
  documentId?: unknown
  slug?: unknown
  title?: unknown
  description?: unknown
  publishedAt?: unknown
  category?: { slug?: unknown, name?: unknown } | null
  matchedIn?: unknown
  snippet?: unknown
}

interface ArticleSearchOptions {
  event: H3Event
  query: string
  locale?: string
  content: boolean
  limit: number
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function toResult(row: UpstreamSearchRow): SearchPostResult | null {
  const documentId = text(row.documentId)
  const slug = text(row.slug)
  if (!documentId || !slug) return null
  const matchedIn = MATCHES.has(row.matchedIn as SearchMatch) ? row.matchedIn as SearchMatch : 'title'
  return {
    documentId,
    slug,
    title: text(row.title) ?? '',
    description: text(row.description),
    publishedAt: text(row.publishedAt),
    category: row.category ? { slug: text(row.category.slug), name: text(row.category.name) } : null,
    matchedIn,
    snippet: text(row.snippet) ?? '',
  }
}

export async function searchArticles({ event, query, locale, content, limit }: ArticleSearchOptions): Promise<SearchPostResult[]> {
  const response = await strapiFetch<{ data?: UpstreamSearchRow[] }>('/api/articles/search', {
    event,
    query: { q: query, locale, content: content ? '1' : undefined, limit: Math.min(limit, SEARCH_MAX_RESULTS) },
    timeout: SEARCH_TIMEOUT_MS,
  })
  return (response?.data ?? []).flatMap(row => toResult(row) ?? [])
}
