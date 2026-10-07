import { randomUUID } from 'node:crypto'
import type { Comment, GuestComment } from '~/interfaces/comment'
import { toPublicComment } from '~/helpers/comments'
import { guestCommentSchema } from '../../schemas/comments'

export default defineEventHandler(async (event): Promise<Comment> => {
  assertSameOrigin(event)
  const relation = commentRelation(event)
  const input = await validBody(event, guestCommentSchema, () => createError({
    statusCode: 400,
    message: 'Content, author name and a valid email are required',
  }))
  const locale = commentLocale(input.locale)
  const comment: GuestComment = {
    author: { id: `guest-${randomUUID()}`, ...input.author },
    content: input.content,
    ...(input.threadOf ? { threadOf: input.threadOf } : {}),
  }
  assertRateLimit(event, 'commentPerIp', clientIp(event))

  const url = `/api/comments/${relation}`

  try {
    const response = await strapiFetch<Comment>(url, {
      event,
      method: 'POST',
      body: { ...comment, locale },
    })
    return toPublicComment(response)
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    console.error('Strapi comment error:', asUpstreamError(error).data || error)
    throw createError({
      statusCode: asUpstreamError(error).response?.status || 500,
      message: upstreamErrorMessage(error, 'Failed to post comment'),
    })
  }
})
