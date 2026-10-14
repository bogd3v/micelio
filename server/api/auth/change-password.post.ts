import { AUTH_TIMEOUT_MS } from '../../lib/constants'
import { changePasswordSchema } from '../../schemas/auth'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  preventCaching(event)
  assertSameOrigin(event)
  const jwt = getSessionToken(event)
  if (!jwt) throw authFailure('unauthorized')

  const { currentPassword, password, passwordConfirmation } = await validBody(event, changePasswordSchema, () => authFailure('invalidInput'))

  let renewed: { jwt?: string }
  try {
    renewed = await strapiFetch<{ jwt?: string }>('/api/auth/change-password', {
      event, timeout: AUTH_TIMEOUT_MS,
      auth: { jwt },
      method: 'POST',
      body: { currentPassword, password, passwordConfirmation },
    })
  } catch (error: unknown) {
    const failure = strapiAuthFailure(event, error, { invalidInput: 'wrongPassword', invalidCredentials: 'wrongPassword' })
    if (failure.statusCode === 401) clearSessionCookie(event)
    throw failure
  }
  // The CMS answers with a new JWT for the same person
  if (renewed.jwt) setSessionCookie(event, renewed.jwt)
  return { ok: true }
})
