import { removeResponseHeader } from 'h3'
import { PREVIEW_PROTOCOL_VERSIONS, PREVIEW_REPORT_INTERVAL_MS } from '~/constants/preview'
import { parseLoadDraft, readyMessage } from '~/helpers/preview'
import {
  boxOfPointer,
  collectBlocks,
  droppedCounter,
  findBlock,
  itemElements,
  placeGap,
  pointedAt,
  readBlockMessage,
  throttled,
} from '~/helpers/previewBlocks'
import type { BlockMessage } from '~/helpers/previewBlocks'
import type { BlockPatch, BlocksReport, PointedBlock, PreviewFrame } from '~/interfaces'

/** What the page gives `usePreviewFrame` so the admin can edit the blocks it shows. */
export interface PreviewBlocksOptions {
  /** Applies a patch to the page's data and answers whether it fitted; the frame drops the message when it did not. */
  patch: (patch: BlockPatch) => boolean
}

const ZONE_SELECTOR = '[data-myc-zone="sections"]'

/**
 * Lets the admin page frame this draft and makes the page talk to it (ADR 0019, sections 4 and 5, and the amendment of 2026-11-02).
 *
 * @remarks
 * Call it only once the CMS has accepted a preview grant. On the server it hands the origin to the policy of the response (`frame-ancestors`, in `server/plugins/contentSecurityPolicy.ts`) and drops `X-Frame-Options`; every other response keeps both.
 *
 * Once mounted inside a frame, the page posts `ready` to `frame.adminOrigin` (never `'*'`) and loads the draft again on a `load-draft` for its own document and locale. When the page marks a zone of blocks (`data-myc-zone`), it also reports their geometry (`micelio:blocks`, `micelio:selected`, `micelio:hovered`) and accepts `micelio:select`, `micelio:hover`, `micelio:insertGap` and, with `options.patch`, `micelio:patch`. The admin draws every outline: the page reports boxes and changes nothing of the site's CSS, and it animates nothing for the protocol.
 *
 * A message from another origin or window, one that fails its shape or names another `version` of the draft, and any other `type` are dropped; in development a malformed one is also counted in the console. Outside a frame it does nothing.
 */
export function usePreviewFrame(frame: PreviewFrame, options?: PreviewBlocksOptions): void {
  if (import.meta.server) {
    const event = useRequestEvent()
    if (event) {
      event.context.previewFrameAncestors = frame.adminOrigin
      removeResponseHeader(event, 'x-frame-options')
    }
  }

  let zone: Element | null = null
  let hover: PointedBlock = { address: null, item: null, box: null }

  function post(type: string, payload: unknown): void {
    window.parent.postMessage({ v: 1, type, payload }, frame.adminOrigin)
  }

  function scrollOffset(): { x: number, y: number } {
    return { x: window.scrollX, y: window.scrollY }
  }

  function reportBlocks(): void {
    if (!zone) return
    const report: BlocksReport = {
      version: frame.version,
      scroll: scrollOffset(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      blocks: collectBlocks(zone, frame.version, scrollOffset()),
    }
    post('micelio:blocks', report)
  }

  const reportSoon = throttled(reportBlocks, PREVIEW_REPORT_INTERVAL_MS)

  // Development only: a production build counts and writes nothing
  const count = droppedCounter(import.meta.dev ? text => console.warn(text) : undefined)

  function drop(): void {
    count()
  }

  function pointed(address: PointedBlock['address'], item: number | null): PointedBlock {
    return { address, item, box: zone ? boxOfPointer(zone, address, item, scrollOffset()) : null }
  }

  function handleBlockMessage(message: BlockMessage): void {
    if (message.kind === 'malformed' || !zone) return drop()
    if (message.kind === 'insertGap') {
      placeGap(zone, message.request.after, message.request.height)
      return reportSoon()
    }
    if (message.kind === 'patch') {
      if (!options?.patch(message.request)) return drop()
      // The components render the new values on the next tick; the observers report the reflow, this reports a change that keeps the size
      void nextTick(reportSoon)
      return
    }
    const { address, item } = message.request
    const block = address ? findBlock(zone, address) : undefined
    if (address && !block) return drop()
    if (message.kind === 'select') {
      if (block && message.request.reveal) (item === null ? block : itemElements(block)[item] ?? block).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      post('micelio:selected', pointed(address, item))
    } else {
      hover = pointed(address, item)
      post('micelio:hovered', hover)
    }
  }

  // Another envelope version of a `load-draft` is ignored, like any message of a version the frame does not speak
  function isMalformedLoadDraft(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false
    const { type, v } = data as { type?: unknown, v?: unknown }
    return type === 'load-draft' && (typeof v !== 'number' || PREVIEW_PROTOCOL_VERSIONS.includes(v))
  }

  function onMessage(event: MessageEvent): void {
    if (event.origin !== frame.adminOrigin || event.source !== window.parent) return
    const message = parseLoadDraft(event.data)
    if (message) {
      if (message.payload.documentId === frame.documentId && message.payload.locale === frame.locale) window.location.reload()
      return
    }
    // A `load-draft` that fails its schema is malformed; any other unknown `type` is ignored
    if (isMalformedLoadDraft(event.data)) return drop()
    const block = readBlockMessage(event.data, frame.version)
    if (block) handleBlockMessage(block)
  }

  function onPointerMove(event: PointerEvent): void {
    if (!zone) return
    const at = pointedAt(zone, event.target, frame.version)
    if ((at ? `${at.address.index}:${at.item}` : '') === (hover.address ? `${hover.address.index}:${hover.item}` : '')) return
    hover = at ? pointed(at.address, at.item) : { address: null, item: null, box: null }
    post('micelio:hovered', hover)
  }

  function onPointerLeave(): void {
    if (!hover.address) return
    hover = { address: null, item: null, box: null }
    post('micelio:hovered', hover)
  }

  // A click on a block selects it. The page does not follow links or submit forms inside the zone while the admin is editing it
  function onClick(event: MouseEvent): void {
    if (!zone) return
    const at = pointedAt(zone, event.target, frame.version)
    if (!at) return
    event.preventDefault()
    post('micelio:selected', pointed(at.address, at.item))
  }

  let stop: (() => void) | undefined

  onMounted(() => {
    if (window.parent === window) return
    zone = document.querySelector(ZONE_SELECTOR)
    window.addEventListener('message', onMessage)
    window.parent.postMessage(readyMessage(frame), frame.adminOrigin)
    if (!zone) return
    const observer = new ResizeObserver(() => reportSoon())
    observer.observe(zone)
    observer.observe(document.body)
    const listeners: Array<[EventTarget, string, EventListener, AddEventListenerOptions]> = [
      [window, 'scroll', reportSoon, { passive: true }],
      [document, 'pointermove', onPointerMove as EventListener, { passive: true }],
      [document.documentElement, 'pointerleave', onPointerLeave, {}],
      [document, 'click', onClick as EventListener, { capture: true }],
    ]
    for (const [target, type, listener, options] of listeners) target.addEventListener(type, listener, options)
    stop = () => {
      observer.disconnect()
      reportSoon.cancel()
      for (const [target, type, listener, options] of listeners) target.removeEventListener(type, listener, options)
      zone = null
    }
    reportBlocks()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('message', onMessage)
    stop?.()
  })
}
