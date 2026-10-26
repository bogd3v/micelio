import qs from 'qs'
import type { DraftPageResponse, Page } from '~/interfaces'
import { withoutIndex } from '~/helpers/preview'
import { PAGE_POPULATE } from '../../../lib/constants'
import { parsePage } from '../../../schemas/page'

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
    raw = inherited ?? (await fetchPreviewDraft<unknown>(event, grant!, documentId, { populate: PAGE_POPULATE })).data
    // The weight report renders the draft once per block without it (`withoutIndex`); only a grant may ask
    const without = withoutIndex(getQuery(event).without)
    const sections = (raw as { sections?: unknown } | null)?.sections
    if (without !== undefined && Array.isArray(sections)) raw = { ...raw as object, sections: sections.filter((_, index) => index !== without) }
  } else {
    const jwt = editorSession(event)
    const query = qs.stringify({ status: 'draft', locale, populate: PAGE_POPULATE }, { skipNulls: true })
    raw = (await fetchAsEditor<{ data?: unknown }>(event, jwt, `/api/pages/${encodeURIComponent(documentId)}`, query)).data
  }

  const config = useRuntimeConfig()
  const parsed = parsePage(raw, { render: markdownRenderer(locale).renderMarkdown, siteUrl: config.public.siteUrl, mediaOrigins: [config.public.strapiUrl, config.mediaUrl] })
  if (!parsed) throw draftNotFound()
  const page: Page = { ...parsed, sections: await resolvePostLists(parsed.sections, locale) }
  const updatedAt = (raw as { updatedAt?: unknown }).updatedAt
  return { page, updatedAt: typeof updatedAt === 'string' ? updatedAt : null, ...(grant && { preview: draftPreview() }) }
})
