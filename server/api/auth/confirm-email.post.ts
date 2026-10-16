import { AUTH_TIMEOUT_MS } from '../../lib/constants'
import { confirmEmailSchema } from '../../schemas/auth'
import type { OkResponse } from '~/interfaces/auth'

export default defineEventHandler(async (event): Promise<OkResponse> => {
  preventCaching(event)
  assertSameOrigin(event)
  const { confirmation } = await validBody(event, confirmEmailSchema, () => authFailure('invalidInput'))

  try {
    await strapiFetch('/api/auth/email-confirmation', { event, timeout: AUTH_TIMEOUT_MS, auth: 'none', method: 'POST', body: { confirmation } })
  } catch (error: unknown) {
    // The CMS answers 400 `Invalid token` for a malformed, unknown or used token; the token itself is never logged
    throw strapiAuthFailure(event, error, { invalidInput: 'invalidCode' })
  }
  logInfo('auth.confirm-email.success', 'Email confirmed', { event })
  return { ok: true }
})
