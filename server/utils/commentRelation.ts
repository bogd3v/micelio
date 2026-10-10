import type { H3Event } from 'h3'
import { isCommentRelation } from '~/helpers/comments'

/**
 * The `relation` query of a comments request, which the comment relation format of `isCommentRelation` must accept.
 *
 * @throws
 * A 400 error with the message `A valid relation parameter is required` when it is missing or malformed.
 */
export function commentRelation(event: H3Event): string {
  const relation = getQuery(event).relation
  if (isCommentRelation(relation)) return relation
  throw createError({
    statusCode: 400,
    message: 'A valid relation parameter is required',
  })
}
