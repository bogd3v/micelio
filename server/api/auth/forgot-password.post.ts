import { AUTH_TIMEOUT_MS } from '../../lib/constants'
import { emailSchema } from '../../schemas/auth'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  preventCaching(event)
  assertSameOrigin(event)
  const { email } = await validBody(event, emailSchema, () => authFailure('invalidInput'))

  try {
    await strapiFetch('/api/auth/forgot-password', { event, timeout: AUTH_TIMEOUT_MS, auth: 'none', method: 'POST', body: { email } })
    logInfo('auth.forgot-password.requested', 'Password reset requested', { event })
  } catch (error: unknown) {
    if (asUpstreamError(error).response?.status === 429) {
      copyRetryAfter(event, error)
      logWarn('auth.failure', 'The CMS rate limit refused the request', { event, cause: 'tooManyRequests' })
      throw authFailure('tooManyRequests')
    }
    logError('cms.forgot-password', 'Sending the reset email failed', { event, error })
  }
  return { ok: true }
})
