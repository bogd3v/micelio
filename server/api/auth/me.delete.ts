import { AUTH_TIMEOUT_MS } from '../../lib/constants'
import type { StrapiAuthUser } from '~/interfaces/auth'
import { deleteAccountSchema } from '../../schemas/auth'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  preventCaching(event)
  assertSameOrigin(event)
  const jwt = getSessionToken(event)
  if (!jwt) {
    logWarn('auth.failure', 'Account deletion without a session', { event, cause: 'unauthorized' })
    throw authFailure('unauthorized')
  }

  const { username, password } = await validBody(event, deleteAccountSchema, () => authFailure('invalidInput'))

  let user: StrapiAuthUser
  try {
    user = await fetchStrapiMe(event, jwt)
  } catch (error: unknown) {
    const failure = strapiAuthFailure(event, error)
    if (failure.statusCode === 401) clearSessionCookie(event)
    throw failure
  }
  if (user.username !== username) {
    logWarn('auth.failure', 'Account deletion refused: the username did not match', { event, cause: 'invalidInput' })
    throw authFailure('invalidInput')
  }

  try {
    await strapiFetch('/api/users/me', {
      event, timeout: AUTH_TIMEOUT_MS,
      auth: { jwt },
      method: 'DELETE',
      body: { password },
    })
  } catch (error: unknown) {
    throw strapiAuthFailure(event, error, { invalidInput: 'wrongPassword', invalidCredentials: 'wrongPassword' })
  }

  clearSessionCookie(event)
  logInfo('auth.account-delete.success', 'Account deleted', { event })
  return { ok: true }
})
