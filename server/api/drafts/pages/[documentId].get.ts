import qs from 'qs'
import type { DraftPage, DraftPageResponse } from '~/interfaces'
import { withoutIndex } from '~/helpers/preview'
import { DRAFT_PAGE_POPULATE } from '../../../lib/constants'
import { parseDraftPage } from '../../../schemas/page'
import { previewContextTargets } from '../../../utils/preview'
import { resolveReusableTargets, withReusableTargets } from '../../../utils/reusableTargets'

export default defineEventHandler(async (event): Promise<DraftPageResponse> => {
  preventCaching(event)
  const documentId = getRouterParam(event, 'documentId')
  if (!documentId) throw draftNotFound()
  const locale = draftLocale(event)

  // A report in process hands its draft down (ADR 0019, amendment of 2026-10-25); otherwise a grant (the admin's iframe) shows the one document it names, or the editor's own session, as for an article draft
  const inherited = previewContextDraft<unknown>(event, 'page', documentId)
  const grant = inherited ? null : previewAdminOrigin() ? previewGrantOf(event) : null
  let raw: unknown
  if (inherited || grant) {
    raw = inherited ?? (await fetchPreviewDraft<unknown>(event, grant!, documentId, { populate: DRAFT_PAGE_POPULATE })).data
    // The weight report renders the draft once per block without it (`withoutIndex`); only a grant may ask
    const without = withoutIndex(getQuery(event).without)
    const sections = (raw as { sections?: unknown } | null)?.sections
    if (without !== undefined && Array.isArray(sections)) raw = { ...raw as object, sections: sections.filter((_, index) => index !== without) }
  } else {
    const jwt = editorSession(event)
    const query = qs.stringify({ status: 'draft', locale, populate: DRAFT_PAGE_POPULATE }, { skipNulls: true })
    raw = (await fetchAsEditor<{ data?: unknown }>(event, jwt, `/api/pages/${encodeURIComponent(documentId)}`, query)).data
  }

  const config = useRuntimeConfig()
  // The copy of a grant bound to a reference carries the reusable block's draft in each reference's relation, which the parse of a section drops: it becomes the reference's `block` (ADR 0019, amendment of 2026-11-23)
  const targets = Boolean(inherited) && previewContextReference(event) !== null
  const context = { render: markdownRenderer(locale).renderMarkdown, siteUrl: config.public.siteUrl, mediaOrigins: [config.public.strapiUrl, config.mediaUrl] }
  const parsed = parseDraftPage(raw, context, { targets })
  if (!parsed) throw draftNotFound()
  // Each other reference draws its target's published block in the page's locale (ADR 0022, section 1): read on each request, or once for a whole weight report, which hands it down
  const read = inherited ? previewContextTargets(event) : null
  const sections = read ? withReusableTargets(parsed.sections, read, context) : await resolveReusableTargets(parsed.sections, locale, context, event)
  const page: DraftPage = { ...parsed, sections: await resolvePostLists(sections, locale) }
  const updatedAt = (raw as { updatedAt?: unknown }).updatedAt
  return { page, updatedAt: typeof updatedAt === 'string' ? updatedAt : null, ...(grant && { preview: draftPreview() }) }
})
