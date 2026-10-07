import type { AuthUserResponse, StrapiAuthUser } from '~/interfaces/auth'
import { toPublicUser } from '~/helpers/auth'
import { loginSchema } from '../../schemas/auth'

export default defineEventHandler(async (event): Promise<AuthUserResponse> => {
  preventCaching(event)
  assertSameOrigin(event)
  const { identifier, password } = await validBody(event, loginSchema, () => authFailure('invalidInput'))

  let jwt: string
  try {
    const response = await strapiFetch<{ jwt: string, user: StrapiAuthUser }>('/api/auth/local', {
      event, timeout: AUTH_TIMEOUT_MS,
      auth: 'none',
      method: 'POST',
      body: { identifier, password },
    })
    jwt = response.jwt
  } catch (error: unknown) {
    throw strapiAuthFailure(event, error, { invalidInput: 'invalidCredentials' })
  }

  try {
    const user = await fetchStrapiMe(event, jwt)
    setSessionCookie(event, jwt)
    return { user: toPublicUser(user) }
  } catch (error: unknown) {
    throw strapiAuthFailure(event, error)
  }
})
