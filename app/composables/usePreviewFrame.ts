import { removeResponseHeader } from 'h3'
import { parseLoadDraft, readyMessage } from '~/helpers/preview'
import type { PreviewFrame } from '~/interfaces'

/**
 * Lets the admin page frame this draft and makes the page talk to it (ADR 0019, sections 4 and 5).
 *
 * @remarks
 * Call it only once the CMS has accepted a preview grant. On the server it hands the origin to the policy of the response (`frame-ancestors`, in `server/plugins/contentSecurityPolicy.ts`) and drops `X-Frame-Options`; every other response keeps both.
 *
 * Once mounted inside a frame, the page posts `ready` to `frame.adminOrigin` (never `'*'`) and loads the draft again on a `load-draft` for its own document and locale. A message from another origin or window, one that fails the schema of the plugin, and any other `type` are dropped. Outside a frame it does nothing.
 */
export function usePreviewFrame(frame: PreviewFrame): void {
  if (import.meta.server) {
    const event = useRequestEvent()
    if (event) {
      event.context.previewFrameAncestors = frame.adminOrigin
      removeResponseHeader(event, 'x-frame-options')
    }
  }

  function onMessage(event: MessageEvent): void {
    if (event.origin !== frame.adminOrigin || event.source !== window.parent) return
    const message = parseLoadDraft(event.data)
    if (message?.payload.documentId === frame.documentId && message.payload.locale === frame.locale) window.location.reload()
  }

  onMounted(() => {
    if (window.parent === window) return
    window.addEventListener('message', onMessage)
    window.parent.postMessage(readyMessage(frame), frame.adminOrigin)
  })
  onBeforeUnmount(() => window.removeEventListener('message', onMessage))
}
