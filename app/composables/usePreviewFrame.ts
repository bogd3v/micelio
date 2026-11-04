import { removeResponseHeader } from 'h3'
import type { PreviewBridgeOptions } from '~/helpers/previewBridge'
import type { PreviewFrame } from '~/interfaces'

/**
 * Lets the admin page frame this draft and makes the page talk to it (ADR 0019, sections 4 and 5, and the amendment of 2026-11-02).
 *
 * @remarks
 * Call it only once the CMS has accepted a preview grant. On the server it hands the origin to the policy of the response (`frame-ancestors`, in `server/plugins/contentSecurityPolicy.ts`) and drops `X-Frame-Options`; every other response keeps both.
 *
 * Once mounted inside a frame, the page posts `ready` to `frame.adminOrigin` (never `'*'`) and loads the draft again on a `load-draft` for its own document and locale. When the page marks a zone of blocks (`data-myc-zone`), it also reports their geometry (`micelio:blocks`, `micelio:selected`, `micelio:hovered`) and accepts `micelio:select`, `micelio:hover`, `micelio:insertGap` and, with `options`, `micelio:patch`. The admin draws every outline: the page reports boxes and changes nothing of the site's CSS, and it animates nothing for the protocol.
 *
 * A message from another origin or window, one that fails its shape or names another `version` of the draft, and any other `type` are dropped; in development a malformed one is also counted in the console. Outside a frame it does nothing.
 *
 * The browser half is `startPreviewBridge` (`app/helpers/previewBridge.ts`), loaded with `import()` once the page is mounted inside a frame. A draft route therefore declares none of its code, and the weight report of the draft (bogd3v/micelio#730) counts the scripts `npm run perf` measures for the page.
 */
export function usePreviewFrame(frame: PreviewFrame, options?: PreviewBridgeOptions): void {
  if (import.meta.server) {
    const event = useRequestEvent()
    if (event) {
      event.context.previewFrameAncestors = frame.adminOrigin
      removeResponseHeader(event, 'x-frame-options')
    }
  }

  let stop: (() => void) | undefined
  let unmounted = false

  onMounted(async () => {
    if (window.parent === window) return
    const { startPreviewBridge } = await import('~/helpers/previewBridge')
    if (unmounted) return
    const end = await startPreviewBridge(frame, options, () => !unmounted)
    if (unmounted) end()
    else stop = end
  })
  onBeforeUnmount(() => {
    unmounted = true
    stop?.()
  })
}
