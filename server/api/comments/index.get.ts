import qs from 'qs'
import type { Comment } from '~/interfaces/comment'
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

  const url = `/api/comments/${relation}${params ? '?' + params : ''}`

  try {
    return toPublicComments(await strapiFetch<Comment[]>(url, { event }))
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    logError('cms.comments', 'Fetching the comments failed', { event, error })
    throw upstreamFailure(error, 'Failed to fetch comments')
  }
})
