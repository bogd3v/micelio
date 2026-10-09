import type { SearchPostResult } from '~/interfaces'
import { MIN_SEARCH_LENGTH } from '~/constants/search'
import { searchQuerySchema } from '../schemas/query'

const PALETTE_RESULTS = 10

export default defineEventHandler(async (event): Promise<SearchPostResult[]> => {
  const { q: term, locale, content } = validQuery(event, searchQuerySchema)

  if (term.length < MIN_SEARCH_LENGTH) {
    return []
  }

  setHeader(event, 'Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

  try {
    return await searchArticles({ event, query: term, locale, content, limit: PALETTE_RESULTS })
  } catch (error: unknown) {
    noStoreOnUpstreamRateLimit(event, error)
    console.error('Search error:', asUpstreamError(error).data || error)
    return []
  }
})
