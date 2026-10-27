import qs from 'qs'
import type { H3Event } from 'h3'
import { PREVIEW_COOKIE, PREVIEW_DRAFT_CONTEXT_KEY, PREVIEW_GRANT_HEADER } from '~/constants/preview'
import { cspOrigin } from '~/helpers/securityHeaders'
import { secondsUntil } from '~/helpers/preview'
import type { DraftPreview } from '~/interfaces'
import type { PreviewActor, PreviewDraftContext } from '../lib/types'
import { previewDraftMetaSchema, previewGrantSchema } from '../schemas/preview'
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

/**
 * Lets the admin page read this response with the editor's grant: sends `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true` and `Vary: Origin` when the request's `Origin` is exactly the configured admin origin, and nothing otherwise.
 *
 * @remarks
 * No wildcard and no other origin is reflected, and with the preview off (`previewAdminOrigin()` is `''`) no request matches. It decides who may read the answer, never who gets it: the grant check is the route's own. Only the weight route calls it (ADR 0019, amendment of 2026-10-25). A `GET` with the cookie is a simple request, so no preflight is answered.
 */
export function allowPreviewAdminOrigin(event: H3Event): void {
  const adminOrigin = previewAdminOrigin()
  if (!adminOrigin || getRequestHeader(event, 'origin') !== adminOrigin) return
  setHeaders(event, { 'Access-Control-Allow-Origin': adminOrigin, 'Access-Control-Allow-Credentials': 'true' })
  appendResponseHeader(event, 'Vary', 'Origin')
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
 * Reads a draft from the CMS with a preview grant, which serves only the document the grant names, and says who the grant acts for.
 *
 * @param query - The Strapi query of the draft (`populate`), encoded by this function.
 * @param options - `allowSystem` accepts a `system` grant too; only the weight route says so, so a route that forgets the check refuses it.
 *
 * @remarks
 * The locale is the grant's, so none is sent. A refusal of the grant (404), of the frontend's API token (401 or 403, also logged as `config.preview-token`), an empty answer, an answer without a known `meta.actor` (logged as `config.preview-actor`: the plugin is older than the system grant) and a `system` actor on a route that does not allow it are the draft 404 of `draftNotFound`; any other failure is a 502, as for the editor session. A `system` grant is single use, so it is spent by this call.
 */
export async function fetchPreviewDraft<T>(event: H3Event, grant: string, documentId: string, query: Record<string, unknown>, options: { allowSystem?: boolean } = {}): Promise<{ data: T, actor: PreviewActor }> {
  const path = `/api/micelio/preview/draft?${qs.stringify({ ...query, documentId }, { skipNulls: true })}`
  let response: { data?: T | null, meta?: unknown }
  try {
    response = await strapiFetch<typeof response>(path, { event, headers: { [PREVIEW_GRANT_HEADER]: grant } })
  } catch (error: unknown) {
    const status = asUpstreamError(error).response?.status
    if (status === 401 || status === 403) logWarn('config.preview-token', 'The CMS refused the frontend API token for the preview draft: it needs plugin::micelio.preview.draft', { event, cause: `upstream ${status}` })
    if (status === 400 || status === 401 || status === 403 || status === 404) throw draftNotFound()
    logError('cms.drafts', 'Fetching the preview draft failed', { event, error })
    throw problem('upstreamUnavailable', { statusMessage: 'Failed to fetch drafts' })
  }
  const meta = previewDraftMetaSchema.safeParse(response.meta)
  if (!meta.success) {
    logWarn('config.preview-actor', 'The CMS answered the preview draft without a known meta.actor: it needs a micelio-plugin-core that sends it', { event })
    throw draftNotFound()
  }
  const { actor } = meta.data
  if (!response.data || (actor === 'system' && !options.allowSystem)) throw draftNotFound()
  return { data: response.data, actor }
}

/**
 * The draft the weight route redeemed for this in-process request, or `null` when the request did not come from it.
 *
 * @remarks
 * Reads `event.context` only, which a server middleware fills from the parent request in process (ADR 0019, amendment of 2026-10-25) and no header, cookie, query or body can set. A draft of another document or another kind is the draft 404: a sub-request never reads a draft it was not made for.
 */
export function previewContextDraft<T>(event: H3Event, kind: PreviewDraftContext['kind'], documentId: string): T | null {
  const context = event.context[PREVIEW_DRAFT_CONTEXT_KEY] as PreviewDraftContext | undefined
  if (!context) return null
  if (context.kind !== kind || context.documentId !== documentId) throw draftNotFound()
  return context.draft as T
}

/** What a draft answer carries to say the request came with a valid grant: the admin origin the frame may talk to. */
export function draftPreview(): DraftPreview {
  return { adminOrigin: previewAdminOrigin() }
}
