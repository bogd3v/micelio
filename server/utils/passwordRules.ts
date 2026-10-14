import type { H3Event } from 'h3'
import { Locale } from '~/interfaces/locale'
import { passwordContextWords, passwordUsesContext } from '~/helpers/passwordContext'
import { isCommonPassword } from '../lib/commonPasswords'

/**
 * Throws the auth failure for a new password that is built from the context or is one of the most common ones.
 *
 * @remarks
 * A refusal is logged as `auth.failure`. `weakPassword` (400) when it holds the username, the address before the `@`, their parts or the name of the site in any language; `commonPassword` (400) when it is one of the 3000 most common passwords. Without `who` (the reset route does not know the account) only the common list is checked. The length is checked by the schemas.
 */
export async function assertPasswordAllowed(event: H3Event, password: string, who?: { username: string, email: string }): Promise<void> {
  if (who) {
    const sites = await Promise.all(Object.values(Locale).map(locale => loadSite(locale)))
    const context = [...new Set(sites.flatMap(({ site }) => passwordContextWords({ ...who, siteName: site.name })))]
    if (passwordUsesContext(password, context)) {
      logWarn('auth.failure', 'Password refused by the rules', { event, cause: 'weakPassword' })
      throw authFailure('weakPassword')
    }
  }
  if (isCommonPassword(password)) {
    logWarn('auth.failure', 'Password refused by the rules', { event, cause: 'commonPassword' })
    throw authFailure('commonPassword')
  }
}
