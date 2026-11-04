import { PREVIEW_PROTOCOL_VERSIONS, PREVIEW_REPORT_INTERVAL_MS } from '../constants/preview'
import { knownSections } from './pages'
import { parseLoadDraft, readyMessage } from './preview'
import {
  boxOfPointer,
  collectBlocks,
  droppedCounter,
  findBlock,
  itemElements,
  blockMarkers,
  patchSections,
  placeGap,
  pointedAt,
  readBlockMessage,
  throttled,
} from './previewBlocks'
import type { BlockMessage } from './previewBlocks'
import type { PageSection } from '../interfaces/page'
import type { BlocksReport, PointedBlock, PreviewFrame } from '../interfaces/preview'

/** What the page gives the bridge so the admin can edit the blocks it shows. */
export interface PreviewBridgeOptions {
  /** The sections the page renders now, which a patch applies to. */
  sections: () => PageSection[] | null | undefined
  /**
   * Gives the page the attributes of each rendered section's root, by position, and marks the zone.
   * The page hands them to `SectionRenderer`, which binds them by the position it renders each section at,
   * so a section that renders nothing cannot shift the others. It answers once Vue has rendered them (the page's `nextTick`).
   */
  mark?: (markers: Array<Record<string, string>>) => Promise<void>
  /**
   * Puts the patched sections in the page's data, so Vue renders them, and answers once it has (the page's `nextTick`).
   *
   * @remarks
   * The page waits for Vue, not the bridge: a module that imports `vue` makes the build split the shared runtime chunk that every public page loads (bogd3v/micelio#732, `npm run perf -- --check`).
   */
  apply: (sections: PageSection[]) => Promise<void>
}

const ZONE_SELECTOR = '[data-myc-zone="sections"]'

/**
 * Starts the conversation of a draft page with the admin that frames it and returns the function that ends it.
 *
 * @remarks
 * This is the browser half of `usePreviewFrame`, in a module of its own that the composable loads once the page is mounted inside a frame, so its code is no part of the scripts a draft route declares and the weight report counts what `npm run perf` measures for the page (bogd3v/micelio#730).
 */
export async function startPreviewBridge(frame: PreviewFrame, options?: PreviewBridgeOptions, isAlive: () => boolean = () => true): Promise<() => void> {
  if (options?.mark) {
    // The renderer binds the attributes when Vue renders; the geometry reads them from the DOM
    await options.mark(knownSections(options.sections()).map((section, index) => blockMarkers(section.__component, index)))
    if (!isAlive()) return () => {}
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

  async function reportAfter(rendered: Promise<void>): Promise<void> {
    await rendered
    reportSoon()
  }

  function handleBlockMessage(message: BlockMessage): void {
    if (message.kind === 'malformed' || !zone) return drop()
    if (message.kind === 'insertGap') {
      placeGap(zone, message.request.after, message.request.height)
      return reportSoon()
    }
    if (message.kind === 'patch') {
      const sections = options ? patchSections(options.sections(), message.request) : undefined
      if (!options || !sections) return drop()
      // The components render the new values when `apply` answers; the observers report the reflow, this reports a change that keeps the size
      void reportAfter(options.apply(sections))
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

  zone = document.querySelector(ZONE_SELECTOR)
  window.addEventListener('message', onMessage)
  window.parent.postMessage(readyMessage(frame), frame.adminOrigin)
  let stop: (() => void) | undefined
  if (zone) {
    const observer = new ResizeObserver(() => reportSoon())
    observer.observe(zone)
    observer.observe(document.body)
    const listeners: Array<[EventTarget, string, EventListener, AddEventListenerOptions]> = [
      [window, 'scroll', reportSoon, { passive: true }],
      [document, 'pointermove', onPointerMove as EventListener, { passive: true }],
      [document.documentElement, 'pointerleave', onPointerLeave, {}],
      [document, 'click', onClick as EventListener, { capture: true }],
    ]
    for (const [target, type, listener, listenerOptions] of listeners) target.addEventListener(type, listener, listenerOptions)
    stop = () => {
      observer.disconnect()
      reportSoon.cancel()
      for (const [target, type, listener, listenerOptions] of listeners) target.removeEventListener(type, listener, listenerOptions)
      zone = null
    }
    reportBlocks()
  }

  return () => {
    window.removeEventListener('message', onMessage)
    stop?.()
  }
}
