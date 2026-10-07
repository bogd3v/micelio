import qs from 'qs'
import type { CommentsResponse } from '~/interfaces/comment'
import { toPublicComments } from '~/helpers/comments'
import { commentsQuerySchema } from '../../schemas/query'

export default defineEventHandler(async (event) => {
  const relation = commentRelation(event)
  const { locale, page, pageSize, sort } = validQuery(event, commentsQuerySchema)

  const params = qs.stringify({
    pagination: { page, pageSize },
    sort,
    locale,
  }, { skipNulls: true })

  const url = `/api/comments/${relation}/flat${params ? '?' + params : ''}`

  try {
    const response = await strapiFetch<CommentsResponse>(url, { event })
    return { ...response, data: toPublicComments(response?.data ?? []) }
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    console.error('Strapi fetch comments (flat) error:', asUpstreamError(error).data || error)
    throw createError({
      statusCode: asUpstreamError(error).response?.status || 500,
      message: upstreamErrorMessage(error, 'Failed to fetch comments'),
    })
  }
})
