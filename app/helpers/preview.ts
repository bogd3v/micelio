import { PREVIEW_PROTOCOL_VERSIONS } from '../constants/preview'
import { defaultLocale, Locale } from '../interfaces/locale'
import type { PreviewFrame, PreviewMode } from '../interfaces/preview'
import schema from '../preview/preview.schema.json'
import { satisfiesSchema } from './jsonSchema'

/** The message a frame posts to the admin once it shows a draft. */
export interface ReadyMessage {
  v: 1
  type: 'ready'
  payload: { v: number[], documentId: string, locale: string | null, version: string }
}

/** A message the frame accepts: the only one of phase 1 that travels towards it. */
export interface LoadDraftMessage {
  v: 1
  type: 'load-draft'
  payload: { documentId: string, locale: string | null }
}

/** The rendering mode a `mode` query asks for; anything but `static` is `dynamic`. */
export function previewMode(value: unknown): PreviewMode {
  return value === 'static' ? 'static' : 'dynamic'
}

/**
 * The position of the block a weight measurement leaves out, from a `without` query; `undefined` for anything but a plain number below 1000.
 *
 * @remarks
 * Only the draft routes read it, and only on a request with a preview grant (`GET /api/preview/{uid}/{documentId}/weight` renders the draft once per block without it).
 */
export function withoutIndex(value: unknown): number | undefined {
  return typeof value === 'string' && /^\d{1,3}$/.test(value) ? Number(value) : undefined
}

/** What `isIslandScript` reads of a head tag: the entry id and the attributes of a `<script>`. */
interface HeadTagLike {
  tag?: string
  key?: string
  props?: Record<string, unknown>
}

/**
 * Whether a head tag loads or declares a heavy or light island (ADR 0006): the JSON declaration of a heavy island, or a script of `/_islands/`.
 *
 * @remarks
 * The static mode of the draft route drops these tags, so each island stays on its static alternative.
 */
export function isIslandScript(tag: HeadTagLike): boolean {
  if (tag.tag !== 'script') return false
  const id = typeof tag.props?.id === 'string' ? tag.props.id : ''
  const src = typeof tag.props?.src === 'string' ? tag.props.src : ''
  return id.startsWith('micelio-island-') || (tag.key ?? '').startsWith('island-') || /\/_islands\//.test(src)
}

/**
 * The path of the draft route for a document, as `/_preview` redirects to it.
 *
 * @remarks
 * A locale that is not one the site serves, or none, opens the default one. The token is never part of it. `without` is the position of a block to leave out, for the weight report.
 */
export function previewDraftPath(kind: 'article' | 'page', documentId: string, locale: string | null, mode?: PreviewMode, without?: number): string {
  const served = Object.values(Locale).find(item => item === locale) ?? defaultLocale
  const prefix = served === defaultLocale ? '' : `/${served}`
  const route = kind === 'page' ? 'drafts/pages' : 'drafts'
  const query = new URLSearchParams({ locale: served, ...(mode === 'static' && { mode }), ...(without !== undefined && { without: String(without) }) })
  return `${prefix}/${route}/${encodeURIComponent(documentId)}?${query}`
}

/** Seconds from `now` until `expiresAt`, rounded up; 0 for a date that has passed or is not a date. */
export function secondsUntil(expiresAt: string, now: number = Date.now()): number {
  const end = Date.parse(expiresAt)
  return Number.isNaN(end) ? 0 : Math.max(0, Math.ceil((end - now) / 1000))
}

/** The `ready` message of a frame (ADR 0019, section 4). */
export function readyMessage(frame: PreviewFrame): ReadyMessage {
  return { v: 1, type: 'ready', payload: { v: [...PREVIEW_PROTOCOL_VERSIONS], documentId: frame.documentId, locale: frame.locale, version: frame.version } }
}

/**
 * Reads a `postMessage` payload as a `load-draft` message.
 *
 * @returns The message, or `undefined` when it fails the schema of the plugin (`app/preview/preview.schema.json`) or is any other message: a receiver drops those, and an unknown `type` is ignored.
 */
export function parseLoadDraft(data: unknown): LoadDraftMessage | undefined {
  if (!satisfiesSchema(schema, data)) return undefined
  const message = data as { type: string }
  return message.type === 'load-draft' ? data as LoadDraftMessage : undefined
}
