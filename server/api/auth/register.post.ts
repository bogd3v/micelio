import { AUTH_TIMEOUT_MS } from '../../lib/constants'
import { Locale } from '~/interfaces/locale'
import type { AuthUserResponse, StrapiAuthUser } from '~/interfaces/auth'
import { toPublicUser } from '~/helpers/auth'
import { registerSchema } from '../../schemas/auth'
import { passwordContextWords, passwordUsesContext } from '~/helpers/passwordContext'
import { isCommonPassword } from '../../lib/commonPasswords'

export default defineEventHandler(async (event): Promise<AuthUserResponse> => {
  preventCaching(event)
  assertSameOrigin(event)
  const { username, email, password } = await validBody(event, registerSchema, () => authFailure('invalidInput'))

  // A password built from what anyone can guess about the person: the username, the address, the name of the site (in each language)
  const sites = await Promise.all(Object.values(Locale).map(locale => loadSite(locale)))
  const context = [...new Set(sites.flatMap(({ site }) => passwordContextWords({ username, email, siteName: site.name })))]
  if (passwordUsesContext(password, context)) throw authFailure('weakPassword')
  if (isCommonPassword(password)) throw authFailure('commonPassword')

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
