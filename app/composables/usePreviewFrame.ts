import { removeResponseHeader } from 'h3'
import manifest from '#build/micelio/islands'
import { islandSrc } from '~/helpers/islands'
import type { PreviewBridgeOptions } from '~/helpers/previewBridge'
import type { PlaygroundEntry, PreviewFrame, PreviewRunOptions } from '~/interfaces'

/** What a draft page gives `usePreviewFrame`: the bridge's options, with `run` lacking the loader of the Worker's driver, which the composable adds. */
export interface PreviewFrameOptions extends Omit<PreviewBridgeOptions, 'run'> {
  run?: Omit<PreviewRunOptions, 'load'>
}

/**
 * Lets the admin page frame this draft and makes the page talk to it (ADR 0019, sections 4 and 5, and the amendment of 2026-11-02).
 *
 * @remarks
 * Call it only once the CMS has accepted a preview grant. On the server it hands the origin to the policy of the response (`frame-ancestors`, in `server/plugins/contentSecurityPolicy.ts`) and drops `X-Frame-Options`; every other response keeps both.
 *
 * Once mounted inside a frame, the page posts `ready` to `frame.adminOrigin` (never `'*'`) and loads the draft again on a `load-draft` for its own document and locale. When the page marks a zone of blocks (`data-myc-zone`), it also reports their geometry (`micelio:blocks`, `micelio:selected`, `micelio:hovered`) and accepts `micelio:select`, `micelio:hover`, `micelio:insertGap` and, with `options`, `micelio:patch`. The admin draws every outline: the page reports boxes and changes nothing of the site's CSS, and it animates nothing for the protocol.
 *
 * With `options.run` the page also answers `micelio:run` with the saved Playground block it names, run in the reader's Worker (ADR 0019, amendment of 2026-11-06). The pool of Workers is the one of the playground island's entry (`app/islands/playground.ts`), which `import()` loads on the first run as it does for a reader, so the draft route declares none of it.
 *
 * A message from another origin or window, one that fails its shape or names another `version` of the draft, and any other `type` are dropped; in development a malformed one is also counted in the console. Outside a frame it does nothing.
 *
 * The browser half is `startPreviewBridge` (`app/helpers/previewBridge.ts`), loaded with `import()` once the page is mounted inside a frame. A draft route therefore declares none of its code, and the weight report of the draft (bogd3v/micelio#730) counts the scripts `npm run perf` measures for the page.
 */
export function usePreviewFrame(frame: PreviewFrame, options?: PreviewFrameOptions): void {
  const runSrc = islandSrc(manifest, 'playground', useRuntimeConfig().app.baseURL)
  // `import()` of the file the loader imports for a reader, as the loader does; without the build's file the run answers `runtimeUnavailable`
  const load = async (): Promise<PlaygroundEntry> => {
    if (!runSrc) throw new Error('The playground island was not built')
    return await import(/* @vite-ignore */ runSrc) as PlaygroundEntry
  }
  const bridgeOptions: PreviewBridgeOptions | undefined = options && { ...options, run: options.run && { ...options.run, load } }

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
    const end = await startPreviewBridge(frame, bridgeOptions, () => !unmounted)
    if (unmounted) end()
    else stop = end
  })
  onBeforeUnmount(() => {
    unmounted = true
    stop?.()
  })
}
