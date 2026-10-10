import { z } from 'zod'
import { isValidEmail } from '~/helpers/auth'
import { webUrlOrNull } from '~/helpers/comments'
import { COMMENT_LIMITS } from '~/constants/comments'

function text(max: number) {
  return z.string().trim().min(1).max(max)
}

/**
 * The body of `POST /api/comments` from a guest: the author name and email, the comment text and, optionally, the comment it answers.
 *
 * @remarks
 * Name, email and content are trimmed and must be non-empty within `COMMENT_LIMITS`; the email is lowercased. An `avatar` that is not an http or https URL, or is longer than `COMMENT_LIMITS.avatar`, is dropped instead of rejecting the request. `threadOf` is a positive integer, or null for a top-level comment. `locale` is not checked here: the route reads it with `commentLocale`.
 */
export const guestCommentSchema = z.object({
  author: z.object({
    name: text(COMMENT_LIMITS.name),
    email: text(COMMENT_LIMITS.email).refine(isValidEmail).transform(email => email.toLowerCase()),
    avatar: z.unknown().optional().transform((value) => {
      const url = webUrlOrNull(value)
      return url && url.length <= COMMENT_LIMITS.avatar ? url : undefined
    }),
  }),
  content: text(COMMENT_LIMITS.content),
  threadOf: z.number().int().positive().nullish(),
  locale: z.unknown().optional(),
})
