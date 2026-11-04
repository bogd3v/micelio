import { PREVIEW_CONTENT_TYPES } from '~/constants/preview'
import { defaultLocale, Locale } from '~/interfaces/locale'
import { ipBucket } from '../../../../lib/clientIp'
import { weightParamsSchema } from '../../../../schemas/preview'

// The social card of a draft, drawn from its title (bogd3v/micelio#734). Authorised by the editor's preview grant, in the `__Host-micelio_preview` cookie that `/_preview` sets (ADR 0019, section 3),
// and by nothing else: the system grant of the amendment of 2026-10-25 is accepted by the weight route only. Every refusal is the same 404, so the answer names nothing; the card is never public.
// The admin page reads the card with the editor's grant in a credentialed `fetch` and stores it as media, so the CORS headers of the weight route (bogd3v/micelio#766) are sent here too
export default defineEventHandler(async (event): Promise<Buffer> => {
  preventCaching(event)
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  // The refusals carry the headers too, so the admin page can tell a 404 from a blocked answer
  allowPreviewAdminOrigin(event)
  // With the preview off (`NUXT_PREVIEW_ADMIN_ORIGIN` unset) no grant exists to present, as for the draft routes
  const grant = previewAdminOrigin() ? previewGrantOf(event) : null
  const params = weightParamsSchema.safeParse(getRouterParams(event, { decode: true }))
  const kind = params.success ? PREVIEW_CONTENT_TYPES[params.data.uid] : undefined
  if (!grant || !params.success || !kind) throw draftNotFound()
  assertRateLimit(event, 'previewCardPerIp', ipBucket(clientIp(event)))

  // The CMS checks the grant and serves only the document it names, in the grant's language; the title and the version are fields of the document, so nothing is populated
  const { documentId } = params.data
  const { data: draft } = await fetchPreviewDraft<{ locale?: unknown }>(event, grant, documentId, {})
  // The site name is read in the language of the draft, so the two words on the card agree
  const locale = Object.values(Locale).find(known => known === draft.locale) ?? defaultLocale
  const card = await previewSocialCard(event, kind, documentId, locale, draft)
  setHeaders(event, { 'Content-Type': 'image/png', 'Content-Length': String(card.length) })
  return card
})
