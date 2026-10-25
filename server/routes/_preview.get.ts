import { PREVIEW_CONTENT_TYPES } from '~/constants/preview'
import { previewDraftPath, previewMode } from '~/helpers/preview'
import { cspOrigin } from '~/helpers/securityHeaders'
import { ipBucket } from '../lib/clientIp'
import { previewQuerySchema } from '../schemas/preview'

// The route the admin's iframe opens with a one-use token (ADR 0019, section 3). Every refusal is the same 404, so the answer names nothing
export default defineEventHandler(async (event) => {
  preventCaching(event)
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const adminOrigin = previewAdminOrigin()
  const query = previewQuerySchema.safeParse(getQuery(event))
  if (!adminOrigin || !query.success) throw problem('notFound', { statusMessage: 'Page not found' })
  assertRateLimit(event, 'previewPerIp', ipBucket(clientIp(event)))

  const grant = await exchangePreviewToken(event, query.data.token)
  const kind = grant ? PREVIEW_CONTENT_TYPES[grant.contentType] : undefined
  // The grant frames the draft for the admin that asked for the token: it must be the one this site is configured for
  if (!grant || !kind || cspOrigin(grant.adminOrigin) !== adminOrigin) {
    if (grant) logWarn('authz.preview-refused', 'The preview grant is for another admin origin or content type', { event, cause: kind ? 'adminOrigin' : 'contentType' })
    throw problem('notFound', { statusMessage: 'Page not found' })
  }
  setPreviewGrantCookie(event, grant.grant, grant.expiresAt)
  return sendRedirect(event, previewDraftPath(kind, grant.documentId, grant.locale, previewMode(query.data.mode)), 303)
})
