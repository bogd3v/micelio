import { resetPasswordSchema } from '../../schemas/auth'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  preventCaching(event)
  assertSameOrigin(event)
  const { code, password, passwordConfirmation } = await validBody(event, resetPasswordSchema, () => authFailure('invalidInput'))

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
