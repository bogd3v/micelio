import {
  PREVIEW_GAP_MAX_HEIGHT,
  PREVIEW_PATCH_FORBIDDEN_FIELDS,
  PREVIEW_PATCH_MAX_ITEMS,
  PREVIEW_PATCH_TEXT_FIELDS,
  PREVIEW_PATCH_TEXT_MAX,
  PREVIEW_PROTOCOL_VERSIONS,
} from '../constants/preview'
import type {
  BlockAddress,
  BlockBox,
  BlockPatch,
  HoverRequest,
  InsertGap,
  ItemBox,
  PatchContent,
  PatchScalar,
  PreviewBox,
  RenderModeRequest,
  RunAddress,
  RunRequest,
  SelectRequest,
} from '../interfaces/preview'
import { knownSections } from './pages'
import type { PageSection } from '../interfaces/page'

/** What `readBlockMessage` makes of a message of phase 2 that travels towards the frame. */
export type BlockMessage
  = | { kind: 'select', request: SelectRequest }
    | { kind: 'hover', request: HoverRequest }
    | { kind: 'insertGap', request: InsertGap }
    | { kind: 'patch', request: BlockPatch }
    | { kind: 'renderMode', request: RenderModeRequest }
    | { kind: 'run', request: RunRequest }
    | { kind: 'malformed' }

/** The `type` of each message of phase 2 and the `kind` it is read as (ADR 0019, amendment of 2026-11-02). */
const KINDS = {
  'micelio:select': 'select',
  'micelio:hover': 'hover',
  'micelio:insertGap': 'insertGap',
  'micelio:patch': 'patch',
  'micelio:renderMode': 'renderMode',
  'micelio:run': 'run',
} as const

/** The keys of a section that hold its repeatable items, in the order a block uses them. */
const ITEM_KEYS = ['items', 'plans', 'logos', 'images'] as const

const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
const BLOCK_ID = /^[a-z0-9-]{1,64}$/
const MAX_INDEX = 10_000
const MAX_REQUEST_ID = 256
const ITEM_SELECTOR = '.myc-section-item'
const BLOCK_SELECTOR = '[data-myc-block]'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < MAX_INDEX
}

function readAddress(value: unknown): BlockAddress | undefined {
  if (!isRecord(value) || value.zone !== 'sections' || !isIndex(value.index)) return undefined
  if (typeof value.block !== 'string' || !BLOCK_ID.test(value.block)) return undefined
  if (typeof value.version !== 'string' || value.version.length === 0 || value.version.length > 64) return undefined
  return { zone: 'sections', index: value.index, block: value.block, version: value.version }
}

function readRunAddress(value: unknown): RunAddress | undefined {
  if (!isRecord(value) || (value.zone !== 'sections' && value.zone !== 'blocks') || !isIndex(value.index)) return undefined
  if (typeof value.block !== 'string' || !BLOCK_ID.test(value.block)) return undefined
  if (typeof value.version !== 'string' || value.version.length === 0 || value.version.length > 64) return undefined
  return { zone: value.zone, index: value.index, block: value.block, version: value.version }
}

function readScalar(value: unknown): PatchScalar | undefined {
  if (value === null) return value
  if (typeof value === 'string') return value.length <= PREVIEW_PATCH_TEXT_MAX ? value : undefined
  return undefined
}

function readContent(value: unknown): PatchContent | undefined {
  if (!isRecord(value)) return undefined
  const content: PatchContent = {}
  for (const [key, item] of Object.entries(value)) {
    const scalar = readScalar(item)
    if (UNSAFE_KEYS.has(key) || PREVIEW_PATCH_FORBIDDEN_FIELDS.has(key) || scalar === undefined) return undefined
    content[key] = scalar
  }
  return content
}

function readPatch(payload: Record<string, unknown>): BlockPatch | undefined {
  const address = readAddress(payload.address)
  const content = readContent(payload.content)
  const rawItems = payload.items
  if (!address || !content || !Array.isArray(rawItems) || rawItems.length > PREVIEW_PATCH_MAX_ITEMS) return undefined
  const items: BlockPatch['items'] = []
  for (const raw of rawItems) {
    const itemContent = isRecord(raw) ? readContent(raw.content) : undefined
    if (!isRecord(raw) || !isIndex(raw.index) || !itemContent) return undefined
    items.push({ index: raw.index, content: itemContent })
  }
  return { address, content, items }
}

function readOptionalItem(value: unknown): number | null | undefined {
  return value === undefined || value === null ? null : isIndex(value) ? value : undefined
}

function readPointer(payload: Record<string, unknown>): { address: BlockAddress | null, item: number | null } | undefined {
  const address = payload.address === null ? null : readAddress(payload.address)
  const item = readOptionalItem(payload.item)
  return address === undefined || item === undefined ? undefined : { address, item: address ? item : null }
}

function readGap(payload: Record<string, unknown>): InsertGap | undefined {
  const { version, zone, after, height } = payload
  if (typeof version !== 'string' || zone !== 'sections') return undefined
  if (after !== null && !isIndex(after)) return undefined
  if (typeof height !== 'number' || !Number.isFinite(height) || height < 0 || height > PREVIEW_GAP_MAX_HEIGHT) return undefined
  return { version, zone, after, height }
}

/**
 * Reads a `postMessage` payload as a message of phase 2 for the frame (ADR 0019, amendment of 2026-11-02).
 *
 * @remarks
 * An address or a `version` that is not `version` makes a stale message, which is `malformed` like one that fails its shape, so a reorder that crosses a reload cannot move the wrong block. A patch never names a field of `PREVIEW_PATCH_FORBIDDEN_FIELDS` or an object, and always carries `items` as an array (empty for none); a `reveal` that is present is a boolean, as in the plugin's contract.
 *
 * @param data - The `data` of the event.
 * @param version - The `updatedAt` of the draft the frame shows.
 * @returns `undefined` for a message that is well formed but not for this receiver (another envelope version, an unknown `type`): a receiver ignores it. A value that is not an envelope (not an object, no `type`, no numeric `v` on a known `type`) is `malformed`.
 */
export function readBlockMessage(data: unknown, version: string): BlockMessage | undefined {
  if (!isRecord(data) || typeof data.type !== 'string') return { kind: 'malformed' }
  if (!Object.hasOwn(KINDS, data.type)) return undefined
  if (typeof data.v !== 'number') return { kind: 'malformed' }
  if (!PREVIEW_PROTOCOL_VERSIONS.includes(data.v)) return undefined
  const kind = KINDS[data.type as keyof typeof KINDS]
  const payload = data.payload
  if (!isRecord(payload)) return { kind: 'malformed' }
  if (kind === 'run') {
    // Only a position and an id: a `code`, `runtime` or `setup` in the payload is ignored, never read
    const { requestId } = payload
    const address = readRunAddress(payload.address)
    return typeof requestId === 'string' && requestId.length > 0 && requestId.length <= MAX_REQUEST_ID && address && address.version === version
      ? { kind, request: { requestId, address } }
      : { kind: 'malformed' }
  }
  if (kind === 'patch') {
    const request = readPatch(payload)
    return request && request.address.version === version ? { kind, request } : { kind: 'malformed' }
  }
  if (kind === 'insertGap') {
    const request = readGap(payload)
    return request && request.version === version ? { kind, request } : { kind: 'malformed' }
  }
  if (kind === 'renderMode') {
    const address = readAddress(payload.address)
    const mode = payload.mode
    return address && address.version === version && (mode === 'dynamic' || mode === 'static') ? { kind, request: { address, mode } } : { kind: 'malformed' }
  }
  const pointer = readPointer(payload)
  if (!pointer || (pointer.address && pointer.address.version !== version)) return { kind: 'malformed' }
  if (kind === 'select' && payload.reveal !== undefined && typeof payload.reveal !== 'boolean') return { kind: 'malformed' }
  return kind === 'select'
    ? { kind, request: { ...pointer, reveal: payload.reveal === true } }
    : { kind, request: pointer }
}

/** The catalogue id of a section component: its name without the namespace (`section.feature-grid` is `feature-grid`). */
export function blockId(component: string): string {
  return component.slice(component.indexOf('.') + 1)
}

/** The attributes that mark the root of the block at `index` among the rendered sections of a preview response (ADR 0019, section 5). */
export function blockMarkers(component: string, index: number): Record<string, string> {
  return { 'data-myc-block': blockId(component), 'data-myc-index': String(index) }
}

function mergeContent<T extends object>(target: T, content: PatchContent, allowed: readonly string[], required: readonly string[]): T | undefined {
  for (const [key, value] of Object.entries(content)) {
    if (!allowed.includes(key)) return undefined
    // The server drops a block or an item whose required text is missing or blank, so the preview refuses it too
    if (required.includes(key) ? typeof value !== 'string' || value.trim() === '' : typeof value !== 'string' && value !== null) return undefined
  }
  return { ...target, ...content }
}

/**
 * The sections with a patch applied to the block at `address.index`, or `undefined` when the patch does not fit.
 *
 * @remarks
 * Only the text fields of `PREVIEW_PATCH_TEXT_FIELDS` change, and only to text (not blank for a field the server requires) or `null` (for an optional one), so the Vue components render the new text through their own escaping; nothing is parsed as Markdown or HTML in the browser (ADR 0019, section 2). A patch that names any other field, an item that is not there or a block whose catalogue id differs from the address is refused whole. The index counts the sections the frontend renders, as `data-myc-index` does.
 */
export function patchSections(sections: PageSection[] | null | undefined, patch: BlockPatch): PageSection[] | undefined {
  const rendered = knownSections(sections)
  const section = rendered[patch.address.index]
  if (!sections || !section || blockId(section.__component) !== patch.address.block) return undefined
  const fields = Object.hasOwn(PREVIEW_PATCH_TEXT_FIELDS, patch.address.block) ? PREVIEW_PATCH_TEXT_FIELDS[patch.address.block]! : undefined
  if (!fields) return undefined
  let next = mergeContent(section, patch.content, fields.section, fields.required?.section ?? [])
  if (!next) return undefined
  if (patch.items.length > 0) {
    const key = ITEM_KEYS.find(name => Array.isArray((section as unknown as Record<string, unknown>)[name]))
    const list = key ? (section as unknown as Record<string, unknown[]>)[key]! : undefined
    if (!key || !list) return undefined
    const items = [...list]
    for (const { index, content } of patch.items) {
      const item = items[index]
      const merged = isRecord(item) ? mergeContent(item, content, fields.item, fields.required?.item ?? []) : undefined
      if (!merged) return undefined
      items[index] = merged
    }
    next = { ...next, [key]: items }
  }
  return sections.map(candidate => candidate === section ? next : candidate)
}

function boxOf(element: Element, scroll: { x: number, y: number }): PreviewBox {
  const rect = element.getBoundingClientRect()
  const round = (value: number): number => Math.round(value * 10) / 10
  return { x: round(rect.left + scroll.x), y: round(rect.top + scroll.y), width: round(rect.width), height: round(rect.height) }
}

/** The blocks of the zone: the elements with `data-myc-block` that are its direct children, a gap's spacer left out. */
export function blockElements(zone: Element): HTMLElement[] {
  return [...zone.querySelectorAll<HTMLElement>(`:scope > ${BLOCK_SELECTOR}`)]
}

/** The repeatable items of a block, in order: its `.myc-section-item`s, the aria-hidden copies of a marquee left out. */
export function itemElements(block: Element): HTMLElement[] {
  return [...block.querySelectorAll<HTMLElement>(ITEM_SELECTOR)].filter(item => !item.closest('[aria-hidden="true"]'))
}

/** The address a block's root carries, or `undefined` for an element that is not a marked block. */
export function addressOf(element: Element, version: string): BlockAddress | undefined {
  const block = element.getAttribute('data-myc-block')
  const index = Number(element.getAttribute('data-myc-index'))
  return block && isIndex(index) ? { zone: 'sections', index, block, version } : undefined
}

/** The marked block of the zone at `address`, when the page has one with that position and catalogue id. */
export function findBlock(zone: Element, address: BlockAddress): HTMLElement | undefined {
  return blockElements(zone).find(element => addressOf(element, address.version)?.index === address.index && element.getAttribute('data-myc-block') === address.block)
}

/** The geometry of every block of the zone and of the items inside it, in document coordinates. */
export function collectBlocks(zone: Element, version: string, scroll: { x: number, y: number }): BlockBox[] {
  const blocks: BlockBox[] = []
  for (const element of blockElements(zone)) {
    const address = addressOf(element, version)
    if (!address) continue
    const items: ItemBox[] = itemElements(element).map((item, index) => ({ index, box: boxOf(item, scroll) }))
    blocks.push({ address, box: boxOf(element, scroll), items })
  }
  return blocks
}

/** The box of a block, or of one of its items when `item` is a position that exists; `null` when there is neither. */
export function boxOfPointer(zone: Element, address: BlockAddress | null, item: number | null, scroll: { x: number, y: number }): PreviewBox | null {
  const block = address ? findBlock(zone, address) : undefined
  if (!block) return null
  const target = item === null ? block : itemElements(block)[item]
  return target ? boxOf(target, scroll) : null
}

/** The block under an element, and the item of it when the element is inside one; `undefined` outside every block of the zone. */
export function pointedAt(zone: Element, target: EventTarget | null, version: string): { address: BlockAddress, item: number | null } | undefined {
  const start = target instanceof Element ? target : null
  const block = start?.closest(BLOCK_SELECTOR)
  if (!block || block.parentElement !== zone) return undefined
  const address = addressOf(block, version)
  if (!address) return undefined
  const item = start!.closest(ITEM_SELECTOR)
  const at = item ? itemElements(block).indexOf(item as HTMLElement) : -1
  return { address, item: at >= 0 ? at : null }
}

/**
 * Opens a gap of `height` pixels after the block at position `after` (the top of the zone for `null`), and closes the one that was open.
 *
 * @remarks
 * The gap is an `aria-hidden` spacer between the blocks, sized through the CSS object model, which the page's CSP allows (it sends no inline `style`). It animates nothing and a block that moves does not know it. Height 0 closes the gap that was open; a position with no block leaves the open gap where it is.
 */
export function placeGap(zone: Element, after: number | null, height: number): void {
  const blocks = blockElements(zone)
  const anchor = after === null ? blocks[0] : blocks.find(block => Number(block.getAttribute('data-myc-index')) === after)
  if (height > 0 && !anchor) return
  zone.querySelectorAll('[data-myc-gap]').forEach(spacer => spacer.remove())
  if (height <= 0 || !anchor) return
  const spacer = zone.ownerDocument.createElement('div')
  spacer.setAttribute('data-myc-gap', '')
  spacer.setAttribute('aria-hidden', 'true')
  spacer.style.height = `${height}px`
  if (after === null) anchor.before(spacer)
  else anchor.after(spacer)
}

/**
 * A function that runs `run` at once and then at most once every `interval` milliseconds, with the last call it was made during the wait.
 *
 * @remarks
 * Written here and not taken from VueUse: the preview code must stay out of the shared chunks that public pages load, and VueUse's helpers share one with other composables.
 */
export function throttled(run: () => void, interval: number): (() => void) & { cancel: () => void } {
  let waiting: ReturnType<typeof setTimeout> | undefined
  let pending = false

  function release(): void {
    waiting = undefined
    if (!pending) return
    pending = false
    run()
    waiting = setTimeout(release, interval)
  }

  function call(): void {
    if (waiting !== undefined) {
      pending = true
      return
    }
    run()
    waiting = setTimeout(release, interval)
  }

  /** Drops the call that waits and the timer, so nothing runs after the owner is gone. */
  function cancel(): void {
    if (waiting !== undefined) clearTimeout(waiting)
    waiting = undefined
    pending = false
  }

  return Object.assign(call, { cancel })
}

/**
 * A counter of the messages the frame dropped as malformed or stale, which writes the count with `write` when there is one.
 *
 * @remarks
 * The frame passes a writer only in development, so a production build counts and says nothing (ADR 0019, section 4).
 */
export function droppedCounter(write?: (text: string) => void): () => number {
  let dropped = 0
  return () => {
    dropped += 1
    write?.(`[micelio] preview: ignored ${dropped} malformed or stale message(s) from the admin`)
    return dropped
  }
}
