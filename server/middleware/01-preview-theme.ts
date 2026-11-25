import { isError } from 'h3'
import { previewDraftTarget } from '~/helpers/preview'
import { PREVIEW_DRAFT_CONTEXT_KEY } from '~/constants/preview'

// The theme override of a preview grant (ADR 0019, amendment of 2026-11-25). The theme a page renders is pinned before Nuxt renders it, and the override
// is known only from the CMS's draft read, so a page of the draft route with a grant reads its `meta` first (no populate) and pins this request, and only
// this one, to the theme it names. A request without a grant, a sub-request of the weight report (whose draft comes from its context) and a system grant
// read no override. The frontend keeps the override nowhere: every load reads it again.
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const target = previewDraftTarget(event.path)
  if (!target || event.context[PREVIEW_DRAFT_CONTEXT_KEY] || !previewAdminOrigin()) return
  const grant = previewGrantOf(event)
  if (!grant) return
  let theme
  try {
    theme = (await fetchPreviewDraft<unknown>(event, grant, target.documentId, {})).overrides?.theme
  } catch (error: unknown) {
    // A refused grant is the page's own 404, which its draft read answers the same way, so it is not answered twice here
    if (isError(error) && error.statusCode === 404) return
    throw error
  }
  if (!theme) return
  const found = await previewedTheme(event, theme)
  if (!found) throw problem('themeNotInstalled')
  pinRequestToPreviewTheme(event, found)
})
