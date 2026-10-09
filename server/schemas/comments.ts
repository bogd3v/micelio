import { z } from 'zod'
import { isValidEmail } from '~/helpers/auth'
import { webUrlOrNull } from '~/helpers/comments'
import { COMMENT_LIMITS } from '~/constants/comments'

function text(max: number) {
  return z.string().trim().min(1).max(max)
}

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
