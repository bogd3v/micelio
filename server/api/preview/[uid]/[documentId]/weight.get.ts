import type { WeightReportResponse } from '~/interfaces'
import { PREVIEW_CONTENT_TYPES } from '~/constants/preview'
import { defaultLocale } from '~/interfaces/locale'
import { ipBucket } from '../../../../lib/clientIp'
import { weightParamsSchema, weightQuerySchema } from '../../../../schemas/preview'

// The weight of a draft as a visitor would download it (bogd3v/micelio#730). Authorised by the preview grant, like the draft routes (ADR 0019, section 3):
// every refusal is the same 404, so the answer names nothing
export default defineEventHandler(async (event): Promise<WeightReportResponse> => {
  preventCaching(event)
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const grant = previewAdminOrigin() ? previewGrantOf(event) : null
  const params = weightParamsSchema.safeParse(getRouterParams(event, { decode: true }))
  const kind = params.success ? PREVIEW_CONTENT_TYPES[params.data.uid] : undefined
  if (!grant || !params.success || !kind) throw draftNotFound()
  const query = validQuery(event, weightQuerySchema)
  assertRateLimit(event, 'previewWeightPerIp', ipBucket(clientIp(event)))

  const { documentId } = params.data
  const data = await previewWeightReport(event, grant, kind, documentId, query.locale ?? defaultLocale, query.mode)
  return { data }
})
