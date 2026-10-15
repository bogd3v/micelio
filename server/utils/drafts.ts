import type { H3Event } from 'h3'
import type { Locale } from '~/interfaces'
import { isLocale } from '~/helpers/locale'

/**
 * The 404 error of a draft that is missing or not visible to the visitor. It is returned, so the caller throws it.
 *
 * @remarks
 * A missing session gets the same answer, so drafts do not show that they exist.
 */
export function draftNotFound() {
  return problem('notFound')
}

/**
 * The session JWT of an editor request.
 *
 * @remarks
 * Throws the draft 404 when there is no session cookie, and logs `authz.draft-refused` with the cause `noSession`. The token is not verified here: the CMS checks it in `fetchAsEditor`.
 */
export function editorSession(event: H3Event): string {
  const jwt = getSessionToken(event)
  if (!jwt) {
    logWarn('authz.draft-refused', 'Draft request without a session', { event, cause: 'noSession' })
    throw draftNotFound()
  }
  return jwt
}

/** The `locale` query of a draft request, or undefined when it is absent or not a supported locale. */
export function draftLocale(event: H3Event): Locale | undefined {
  const locale = getQuery(event).locale
  return isLocale(locale) ? locale : undefined
}

/**
 * Reads a draft path from the CMS with the editor JWT and returns the body.
 *
 * @param query - The encoded query string, without the leading question mark; empty for none.
 *
 * @remarks
 * A CMS 401, 403 or 404 is the draft 404 of `draftNotFound`; a 401 or 403 is also logged as `authz.draft-refused`. Any other failure is logged with the CMS status and message, and answered with a 502 `Failed to fetch drafts`.
 */
export async function fetchAsEditor<T>(event: H3Event, jwt: string, path: string, query: string): Promise<T> {
  try {
    return await strapiFetch<T>(query ? `${path}?${query}` : path, { event, auth: { jwt } })
  } catch (error: unknown) {
    const status = asUpstreamError(error).response?.status
    if (status === 401 || status === 403) logWarn('authz.draft-refused', 'The CMS refused the editor session', { event, cause: `upstream ${status}` })
    if (status === 401 || status === 403 || status === 404) throw draftNotFound()
    logError('cms.drafts', 'Fetching the drafts failed', { event, error })
    throw problem('upstreamUnavailable', { statusMessage: 'Failed to fetch drafts' })
  }
}
