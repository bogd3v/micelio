import { PREVIEW_COOKIE, PREVIEW_DRAFT_CONTEXT_KEY } from '~/constants/preview'

/**
 * Opens a page to an editor, and answers 404 to anyone else.
 *
 * @remarks
 * A page that sets `previewGrant` in its meta also opens for a request that carries a preview grant (ADR 0019, section 3), and for one the weight report makes in process, which is known by a key in the server-side `event.context` that no header, cookie, query or body can set (amendment of 2026-10-25); the client runs it from the payload. The grant cookie is `HttpOnly`, so only the server sees it and the answer travels in the payload to the client's own run of the middleware. The grant is not checked here: the draft's API route asks the CMS, and a refusal is the same 404 as a missing session. It lives in this middleware, not in one of its own, so the head of every public page keeps the same prefetch links.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.previewGrant) {
    const hasGrant = useState<boolean>('preview-grant', () => import.meta.server && (Boolean(useRequestHeaders(['cookie']).cookie?.includes(`${PREVIEW_COOKIE}=`)) || Boolean(useRequestEvent()?.context[PREVIEW_DRAFT_CONTEXT_KEY])))
    if (hasGrant.value) return
  }
  const { ensure, isEditor } = useAuth()
  await ensure()
  if (isEditor.value) return
  return abortNavigation(createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true }))
})
