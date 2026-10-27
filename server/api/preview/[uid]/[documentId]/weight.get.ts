import type { WeightReportResponse } from '~/interfaces'
import { PREVIEW_CONTENT_TYPES, PREVIEW_GRANT_HEADER, PREVIEW_GRANT_MAX_LENGTH } from '~/constants/preview'
import { defaultLocale } from '~/interfaces/locale'
import { ipBucket } from '../../../../lib/clientIp'
import { weightParamsSchema, weightQuerySchema } from '../../../../schemas/preview'

// The weight of a draft as a visitor would download it (bogd3v/micelio#730). Authorised by a preview grant, like the draft routes (ADR 0019, section 3):
// the editor's, in the cookie, or the CMS's own `system` grant of the amendment of 2026-10-25, in `X-Micelio-Preview-Grant`. Every refusal is the same 404, so the answer names nothing
export default defineEventHandler(async (event): Promise<WeightReportResponse> => {
  preventCaching(event)
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  // The admin page reads the report with the editor's grant in a credentialed `fetch`; the refusals carry the headers too, so it can tell a 404 from a blocked answer
  allowPreviewAdminOrigin(event)
  const sent = getRequestHeader(event, PREVIEW_GRANT_HEADER) || null
  const systemGrant = sent && sent.length <= PREVIEW_GRANT_MAX_LENGTH ? sent : null
  // The header opens the route whatever `NUXT_PREVIEW_ADMIN_ORIGIN` says: a `system` grant frames nothing. The cookie stays behind that gate
  const grant = sent ? systemGrant : previewAdminOrigin() ? previewGrantOf(event) : null
  // Read once and removed: the renders of the report (`event.$fetch`) and the files they declare forward the caller's headers, and neither the grant nor the caller's cookies belong in them
  for (const name of [PREVIEW_GRANT_HEADER.toLowerCase(), 'cookie']) Reflect.deleteProperty(event.node.req.headers, name)
  const params = weightParamsSchema.safeParse(getRouterParams(event, { decode: true }))
  const kind = params.success ? PREVIEW_CONTENT_TYPES[params.data.uid] : undefined
  if (!grant || !params.success || !kind) throw draftNotFound()
  const query = validQuery(event, weightQuerySchema)
  const bucket = ipBucket(clientIp(event))
  // A caller of the header is limited per address first, in the bucket sized for bulk publishing; the per-document count waits for the CMS to confirm the grant
  assertRateLimit(event, sent ? 'previewWeightSystemPerIp' : 'previewWeightPerIp', bucket)

  const { documentId, uid } = params.data
  const { actor, draft } = await redeemDraft(event, grant, kind, documentId)
  // The header is the CMS's: a grant of the editor is the cookie's, behind the origin gate
  if (sent && actor !== 'system') throw draftNotFound()
  if (actor === 'system') assertRateLimit(event, 'previewWeightPerDocument', `${uid}:${documentId}`)
  const data = await previewWeightReport(event, kind, documentId, query.locale ?? defaultLocale, query.mode, draft)
  return { data }
})
