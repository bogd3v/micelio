import { emailSchema } from '../../schemas/auth'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  preventCaching(event)
  assertSameOrigin(event)
  const { email } = await validBody(event, emailSchema, () => authFailure('invalidInput'))

  try {
    await strapiFetch('/api/auth/forgot-password', { event, timeout: AUTH_TIMEOUT_MS, auth: 'none', method: 'POST', body: { email } })
  } catch (error: unknown) {
    if (asUpstreamError(error).response?.status === 429) {
      copyRetryAfter(event, error)
      throw authFailure('tooManyRequests')
    }
    console.error('Strapi forgot-password error:', asUpstreamError(error).data?.error?.message || error)
  }
  return { ok: true }
})
