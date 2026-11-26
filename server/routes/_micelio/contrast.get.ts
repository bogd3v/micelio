import { ipBucket } from '../../lib/clientIp'
import { contrastQuerySchema } from '../../schemas/preview'

// The contrast matrix of the active theme with candidate accents, for the Customize page of the admin (bogd3v/micelio#737), so that the admin and
// `theme:check` give the same AA result. Authorised by the editor's preview grant, as the card route is: the grant cookie of `/_preview`, checked by the
// CMS's draft read of the document it names, and nothing else (a system grant is refused). Every refusal is the same 404; the answer is never public.
export default defineEventHandler(async (event) => {
  preventCaching(event)
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  // The refusals carry the headers too, so the admin page can tell a 404 from a blocked answer
  allowPreviewAdminOrigin(event)
  // With the preview off (`NUXT_PREVIEW_ADMIN_ORIGIN` unset) no grant exists to present, as for the draft routes
  const grant = previewAdminOrigin() ? previewGrantOf(event) : null
  const query = contrastQuerySchema.safeParse(getQuery(event))
  if (!grant || !query.success) throw draftNotFound()
  assertRateLimit(event, 'previewContrastPerIp', ipBucket(clientIp(event)))

  // The CMS checks the grant and that it is an editor's; nothing of the draft is read
  await fetchPreviewDraft<unknown>(event, grant, query.data.documentId, {})
  const { runtime } = event.context.activeTheme ?? activeTheme()
  return { data: contrastReport(runtime, query.data.accent) }
})
