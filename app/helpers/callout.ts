import type { CalloutTone } from '../interfaces/design'
import { escapeHtml } from './code'

export const CALLOUT_GLYPHS: Readonly<Record<CalloutTone, string>> = { note: '◆', warning: '▲', danger: '✕' }

const MARKER_TONES: Readonly<Record<string, CalloutTone>> = {
  NOTE: 'note',
  TIP: 'note',
  IMPORTANT: 'note',
  WARNING: 'warning',
  CAUTION: 'danger',
}

const MARKER = /^\[!(\w+)\][ \t]*(.*)$/

export interface CalloutMarker {
  tone: CalloutTone
  title?: string
  body: string
}

export function parseCalloutMarker(text: string): CalloutMarker | null {
  const [first = '', ...rest] = text.split('\n')
  const match = MARKER.exec(first.trim())
  const tone = match ? MARKER_TONES[match[1]!.toUpperCase()] : undefined
  if (!match || !tone) return null
  return { tone, title: match[2]!.trim() || undefined, body: rest.join('\n') }
}

export function renderCalloutHtml(tone: CalloutTone, heading: string, bodyHtml: string): string {
  const role = tone === 'danger' ? 'alert' : 'note'
  return `<aside class="myc-callout myc-callout-${tone} not-prose" role="${role}"><span class="myc-callout-label"><span aria-hidden="true">${CALLOUT_GLYPHS[tone]} </span>${escapeHtml(heading)}</span><div class="myc-callout-body">${bodyHtml}</div></aside>\n`
}
