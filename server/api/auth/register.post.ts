import type { AuthUserResponse, StrapiAuthUser } from '~/interfaces/auth'
import { toPublicUser } from '~/helpers/auth'
import { registerSchema } from '../../schemas/auth'

export default defineEventHandler(async (event): Promise<AuthUserResponse> => {
  preventCaching(event)
  assertSameOrigin(event)
  const { username, email, password } = await validBody(event, registerSchema, () => authFailure('invalidInput'))

  try {
    const response = await strapiFetch<{ user: StrapiAuthUser }>('/api/auth/local/register', {
      event, timeout: AUTH_TIMEOUT_MS,
      auth: 'none',
      method: 'POST',
      body: { username, email, password },
    })
    setResponseStatus(event, 201)
    return { user: toPublicUser(response.user) }
  } catch (error: unknown) {
    throw strapiAuthFailure(event, error)
  }
})
