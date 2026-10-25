import qs from 'qs'
import type { DraftPageResponse, Page } from '~/interfaces'
import { PAGE_POPULATE } from '../../../lib/constants'
import { parsePage } from '../../../schemas/page'

export default defineEventHandler(async (event): Promise<DraftPageResponse> => {
  preventCaching(event)
  const documentId = getRouterParam(event, 'documentId')
  if (!documentId) throw draftNotFound()
  const locale = draftLocale(event)

  // A grant (the admin's iframe, ADR 0019) shows the one document it names; otherwise the editor's own session, as for an article draft
  const grant = previewAdminOrigin() ? previewGrantOf(event) : null
  let raw: unknown
  if (grant) {
    raw = await fetchPreviewDraft<unknown>(event, grant, documentId, { populate: PAGE_POPULATE })
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
