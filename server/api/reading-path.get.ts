import qs from 'qs'
import type { RawStrapiArticle, ReadingPath, ReadingPathStep, StrapiPaginatedResponse } from '~/interfaces'
import { readingPathQuerySchema } from '../schemas/query'

const MAX_STEPS = 50

export default defineEventHandler(async (event): Promise<ReadingPath> => {
  const { category, locale } = validQuery(event, readingPathQuerySchema)

  async function fetchSteps(editorial: boolean): Promise<ReadingPathStep[]> {
    const params = qs.stringify({
      filters: {
        category: { slug: { $eq: category } },
        ...(editorial ? { pathOrder: { $notNull: true } } : {}),
      },
      fields: ['documentId', 'slug', 'title'],
      sort: editorial ? ['pathOrder:asc', 'publishedAt:asc'] : 'publishedAt:asc',
      pagination: { page: 1, pageSize: MAX_STEPS },
      locale,
    }, { skipNulls: true })
    const response = await strapiFetch<StrapiPaginatedResponse<RawStrapiArticle[]>>(`/api/articles?${params}`, { event })
    return response.data.map(article => ({ documentId: article.documentId, slug: article.slug, title: article.title }))
  }

  setHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

  try {
    let editorial: ReadingPathStep[] = []
    try {
      editorial = await fetchSteps(true)
    } catch (error: unknown) {
      if (asUpstreamError(error).response?.status !== 400) throw error
    }
    if (editorial.length > 0) return { category, editorial: true, steps: editorial }
    return { category, editorial: false, steps: await fetchSteps(false) }
  } catch (error: unknown) {
    console.error('Strapi fetch reading path error:', asUpstreamError(error).data || error)
    throw createError({ statusCode: 502, message: upstreamErrorMessage(error, 'Failed to fetch the reading path') })
  }
})
