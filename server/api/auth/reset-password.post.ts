import { AUTH_TIMEOUT_MS } from '../../lib/constants'
import { resetPasswordSchema } from '../../schemas/auth'
import { isCommonPassword } from '../../lib/commonPasswords'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  preventCaching(event)
  assertSameOrigin(event)
  const { code, password, passwordConfirmation } = await validBody(event, resetPasswordSchema, () => authFailure('invalidInput'))
  if (isCommonPassword(password)) throw authFailure('commonPassword')

  try {
    await strapiFetch('/api/auth/reset-password', {
      event, timeout: AUTH_TIMEOUT_MS,
      auth: 'none',
      method: 'POST',
      body: { code, password, passwordConfirmation },
    })
  } catch (error: unknown) {
    throw strapiAuthFailure(event, error, { invalidInput: 'invalidCode' })
  }
  return { ok: true }
})
