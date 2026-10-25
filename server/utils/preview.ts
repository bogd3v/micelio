import qs from 'qs'
import type { H3Event } from 'h3'
import { PREVIEW_COOKIE, PREVIEW_GRANT_HEADER } from '~/constants/preview'
import { cspOrigin } from '~/helpers/securityHeaders'
import { secondsUntil } from '~/helpers/preview'
import type { DraftPreview } from '~/interfaces'
import { previewGrantSchema } from '../schemas/preview'
import type { PreviewGrant } from '../schemas/preview'

/**
 * The origin of the admin that may frame a draft, from `NUXT_PREVIEW_ADMIN_ORIGIN`; `''` when the preview is off.
 *
 * @remarks
 * A value that is not an `http` or `https` origin `cspOrigin()` accepts counts as unset: it would otherwise reach `frame-ancestors`.
 */
export function previewAdminOrigin(): string {
  return cspOrigin(String(useRuntimeConfig().previewAdminOrigin ?? ''))
}

/** The preview grant of the request, from `__Host-micelio_preview`, or `null` when the cookie is absent. */
export function previewGrantOf(event: H3Event): string | null {
  return getCookie(event, PREVIEW_COOKIE) || null
}

/**
 * Keeps a grant in the `__Host-micelio_preview` cookie until the grant expires.
 *
 * @remarks
 * `HttpOnly`, `Secure`, `SameSite=None` and `Partitioned`, so a browser sends it inside the admin's cross-site frame and only there (ADR 0019, section 3). `Path=/` and no `Domain`, as the `__Host-` prefix requires.
 */
export function setPreviewGrantCookie(event: H3Event, grant: string, expiresAt: string): void {
  setCookie(event, PREVIEW_COOKIE, grant, { httpOnly: true, secure: true, sameSite: 'none', partitioned: true, path: '/', maxAge: Math.max(1, secondsUntil(expiresAt)) })
}

/**
 * Exchanges a preview token for a grant with the CMS, using the frontend's API token.
 *
 * @returns The grant, or `null` when the CMS refuses it: the token is unknown, used, expired or of another site, or the API token lacks the preview permission (logged as `config.preview-token`, since that is the operator's to fix).
 *
 * @remarks
 * Any other failure of the CMS is a 502. The token and the grant are in no log.
 */
export async function exchangePreviewToken(event: H3Event, token: string): Promise<PreviewGrant | null> {
  let answer: unknown
  try {
    answer = await strapiFetch<unknown>('/api/micelio/preview/exchange', { event, method: 'POST', body: { token } })
  } catch (error: unknown) {
    const status = asUpstreamError(error).response?.status
    if (status === 401 || status === 403) logWarn('config.preview-token', 'The CMS refused the frontend API token for the preview exchange: it needs plugin::micelio.preview.exchange', { event, cause: `upstream ${status}` })
    if (status === 400 || status === 401 || status === 403 || status === 404) return null
    if (isUpstreamRateLimit(error)) {
      copyRetryAfter(event, error)
      throw problem('tooManyRequests')
    }
    logError('cms.preview', 'The preview exchange failed', { event, error })
    throw problem('upstreamUnavailable', { message: 'Failed to start the preview' })
  }
  const parsed = previewGrantSchema.safeParse(answer)
  if (!parsed.success) {
    logError('cms.preview', 'The CMS answered the preview exchange with an unexpected shape', { event })
    throw problem('upstreamUnavailable', { message: 'Failed to start the preview' })
  }
  return parsed.data.data
}

/**
 * Reads a draft from the CMS with a preview grant, which serves only the document the grant names.
 *
 * @param query - The Strapi query of the draft (`populate`), encoded by this function.
 *
 * @remarks
 * The locale is the grant's, so none is sent. A refusal of the grant (404), of the frontend's API token (401 or 403, also logged as `config.preview-token`) or an empty answer is the draft 404 of `draftNotFound`; any other failure is a 502, as for the editor session.
 */
export async function fetchPreviewDraft<T>(event: H3Event, grant: string, documentId: string, query: Record<string, unknown>): Promise<T> {
  const path = `/api/micelio/preview/draft?${qs.stringify({ ...query, documentId }, { skipNulls: true })}`
  let response: { data?: T | null }
  try {
    response = await strapiFetch<{ data?: T | null }>(path, { event, headers: { [PREVIEW_GRANT_HEADER]: grant } })
  } catch (error: unknown) {
    const status = asUpstreamError(error).response?.status
    if (status === 401 || status === 403) logWarn('config.preview-token', 'The CMS refused the frontend API token for the preview draft: it needs plugin::micelio.preview.draft', { event, cause: `upstream ${status}` })
    if (status === 400 || status === 401 || status === 403 || status === 404) throw draftNotFound()
    logError('cms.drafts', 'Fetching the preview draft failed', { event, error })
    throw problem('upstreamUnavailable', { statusMessage: 'Failed to fetch drafts' })
  }
  if (!response.data) throw draftNotFound()
  return response.data
}

/** What a draft answer carries to say the request came with a valid grant: the admin origin the frame may talk to. */
export function draftPreview(): DraftPreview {
  return { adminOrigin: previewAdminOrigin() }
}
