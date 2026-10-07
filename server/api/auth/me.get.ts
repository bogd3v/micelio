import type { AuthUserResponse } from '~/interfaces/auth'
import { toPublicUser } from '~/helpers/auth'

export default defineEventHandler(async (event): Promise<AuthUserResponse> => {
  preventCaching(event)
  const jwt = getSessionToken(event)
  if (!jwt) return { user: null }

  try {
    return { user: toPublicUser(await fetchStrapiMe(event, jwt)) }
  } catch (error: unknown) {
    const status = asUpstreamError(error).response?.status
    if (status === 401 || status === 403) {
      clearSessionCookie(event)
      return { user: null }
    }
    throw strapiAuthFailure(event, error)
  }
})
