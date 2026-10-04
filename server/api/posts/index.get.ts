import qs from 'qs'
import { defaultLocale } from '~/interfaces'
import type { RawStrapiArticle, StrapiPaginatedResponse } from '~/interfaces'
import { MIN_SEARCH_LENGTH } from '~/helpers/search'
import { postsQuerySchema } from '../../schemas/query'

const RANKING_TIMEOUT_MS = 3000
const STATS_TIMEOUT_MS = 3000

const POPULATE = {
  cover: { populate: '*' },
  category: { populate: '*' },
  author: { populate: '*' },
  seo: { populate: '*' },
  tags: { fields: ['name', 'slug'] },
}

interface RankingPage {
  data: Array<{ documentId: string }>
  meta: StrapiPaginatedResponse<unknown>['meta']
}

interface UpstreamStats {
  likes?: unknown
  boosts?: unknown
  replies?: unknown
}

type BatchStats = Record<string, UpstreamStats>

function conversation(stats: UpstreamStats | undefined): number {
  return (Number(stats?.likes) || 0) + (Number(stats?.boosts) || 0) + (Number(stats?.replies) || 0)
}

function publishedTime(article: RawStrapiArticle): number {
  return new Date(article.publishedAt ?? 0).getTime()
}

export default defineEventHandler(async (event) => {
  const { page, pageSize, locale, category, tag, search, sort: requestedSort, content } = validQuery(event, postsQuerySchema)
  // The fediverse ranking needs the fediverse module; without it the list falls back to the newest first
  const sort = requestedSort === 'fediverse' && !(await loadSiteCached(defaultLocale)).site.modules.fediverse ? undefined : requestedSort
  const validSearch = search && search.length >= MIN_SEARCH_LENGTH ? search : undefined
  const contentSearch = Boolean(validSearch) && content

  const filters: Record<string, unknown> = {}
  if (category) filters.category = { slug: { $eq: category } }
  if (tag) filters.tags = { slug: { $eq: tag } }
  if (validSearch && !contentSearch) filters.title = { $containsi: validSearch }

  async function fetchArticles(params: Record<string, unknown>): Promise<StrapiPaginatedResponse<RawStrapiArticle[]>> {
    const queryString = qs.stringify({ populate: POPULATE, locale, ...params }, { skipNulls: true })
    return strapiFetch<StrapiPaginatedResponse<RawStrapiArticle[]>>(`/api/articles?${queryString}`)
  }

  async function fetchRanked(): Promise<StrapiPaginatedResponse<RawStrapiArticle[]> | null> {
    let ranking: RankingPage
    try {
      ranking = await $fetch<RankingPage>(strapiUrl('/api/fediverse/articles/ranking'), {
        query: { page, pageSize, locale, category, tag, search: validSearch },
        timeout: RANKING_TIMEOUT_MS,
      })
    } catch (error: unknown) {
      console.error('Strapi fetch fediverse ranking error:', asUpstreamError(error).data || error)
      return null
    }

    const ids = ranking.data.map(row => row.documentId)
    if (ids.length === 0) return { data: [], meta: ranking.meta }

    const articles = await fetchArticles({
      filters: { ...filters, documentId: { $in: ids } },
      pagination: { page: 1, pageSize: ids.length },
    })
    const byId = new Map(articles.data.map(article => [article.documentId, article]))
    return {
      data: ids.flatMap(id => byId.get(id) ?? []),
      meta: ranking.meta,
    }
  }

  function emptyPage(): StrapiPaginatedResponse<RawStrapiArticle[]> {
    return { data: [], meta: { pagination: { page, pageSize, pageCount: 0, total: 0 } } }
  }

  async function fetchStats(ids: string[]): Promise<BatchStats | null> {
    try {
      return await $fetch<BatchStats>(strapiUrl('/api/fediverse/articles/stats'), {
        query: { documentIds: ids.join(',') },
        timeout: STATS_TIMEOUT_MS,
      })
    } catch (error: unknown) {
      console.error('Strapi fetch fediverse batch stats error:', asUpstreamError(error).data || error)
      return null
    }
  }

  async function fetchContentMatches(): Promise<StrapiPaginatedResponse<RawStrapiArticle[]>> {
    const matches = await searchArticles({ query: validSearch!, locale, content: true, limit: SEARCH_MAX_RESULTS })
    if (matches.length === 0) return emptyPage()

    const ids = matches.map(match => match.documentId)
    const snippets = new Map(matches.map(match => [match.documentId, match.snippet]))
    const withSnippet = (article: RawStrapiArticle): RawStrapiArticle => ({ ...article, snippet: snippets.get(article.documentId) ?? null })
    const scoped = { ...filters, documentId: { $in: ids } }

    const stats = sort === 'fediverse' ? await fetchStats(ids) : null
    if (!stats) {
      const response = await fetchArticles({
        filters: scoped,
        pagination: { page, pageSize },
        sort: sort === 'oldest' ? 'publishedAt:asc' : 'publishedAt:desc',
      })
      return { ...response, data: response.data.map(withSnippet) }
    }

    const all = await fetchArticles({ filters: scoped, pagination: { page: 1, pageSize: ids.length } })
    const ranked = [...all.data].sort((a, b) =>
      conversation(stats[b.documentId]) - conversation(stats[a.documentId]) || publishedTime(b) - publishedTime(a),
    )
    const start = (page - 1) * pageSize
    return {
      data: ranked.slice(start, start + pageSize).map(withSnippet),
      meta: { pagination: { page, pageSize, pageCount: Math.ceil(ranked.length / pageSize), total: ranked.length } },
    }
  }

  setHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

  try {
    if (contentSearch) {
      return await fetchContentMatches()
    }
    if (sort === 'fediverse') {
      const ranked = await fetchRanked()
      if (ranked) return ranked
    }
    return await fetchArticles({
      pagination: { page, pageSize },
      sort: sort === 'oldest' ? 'publishedAt:asc' : 'publishedAt:desc',
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
    })
  } catch (error: unknown) {
    throw createError({
      statusCode: asUpstreamError(error).response?.status === 400 ? 400 : 502,
      message: 'Failed to fetch posts',
    })
  }
})
