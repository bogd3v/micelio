import { z } from 'zod'
import { newsletterLanguage } from '~/helpers/newsletter'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LENGTH = 254
const INVALID_EMAIL = 'Invalid email format'

/**
 * The body of `POST /api/newsletter/subscribe`: an email address that is non-empty, at most 254 characters and has a dot in its domain, and an optional locale.
 *
 * @remarks
 * The address is trimmed and lowercased. Any locale other than `es` reads as `en`, so the locale never rejects a request. A failing address is a 400 from the route.
 */
export const subscribeSchema = z.object({
  email: z.string({ error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .max(MAX_EMAIL_LENGTH, INVALID_EMAIL)
    .regex(EMAIL_PATTERN, INVALID_EMAIL)
    .transform(email => email.toLowerCase()),
  locale: z.unknown().optional().transform(newsletterLanguage),
})
