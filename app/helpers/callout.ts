import type { CalloutTone } from '../interfaces/design'
import { escapeHtml } from './code'

/** The glyph of each callout tone; the callout markup hides it from assistive technology. */
export const CALLOUT_GLYPHS: Readonly<Record<CalloutTone, string>> = { note: '◆', warning: '▲', danger: '✕' }

const MARKER_TONES: Readonly<Record<string, CalloutTone>> = {
  NOTE: 'note',
  TIP: 'note',
  IMPORTANT: 'note',
  WARNING: 'warning',
  CAUTION: 'danger',
}

const MARKER = /^\[!(\w+)\][ \t]*(.*)$/

interface CalloutMarker {
  tone: CalloutTone
  title?: string
  body: string
}

/**
 * Reads a GitHub-style marker (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`) on the first line of a blockquote.
 *
 * @remarks
 * Null when the first line has no known marker, so the quote renders as a plain blockquote. `title` is undefined when the marker
 * line has no text after the marker; `body` is the rest of the quote.
 */
export function parseCalloutMarker(text: string): CalloutMarker | null {
  const [first = '', ...rest] = text.split('\n')
  const match = MARKER.exec(first.trim())
  const tone = match ? MARKER_TONES[match[1]!.toUpperCase()] : undefined
  if (!match || !tone) return null
  return { tone, title: match[2]!.trim() || undefined, body: rest.join('\n') }
}

/**
 * The HTML of a callout: an `aside` with the tone's glyph and the heading, and the body.
 *
 * @remarks
 * `danger` callouts have `role="alert"`, the others `role="note"`. `heading` is escaped; `bodyHtml` is inserted as it is, so the
 * caller passes HTML that is already rendered (the Markdown renderer sanitizes the whole output).
 */
export function renderCalloutHtml(tone: CalloutTone, heading: string, bodyHtml: string): string {
  const role = tone === 'danger' ? 'alert' : 'note'
  return `<aside class="myc-callout myc-callout-${tone} not-prose" role="${role}"><span class="myc-callout-label"><span aria-hidden="true">${CALLOUT_GLYPHS[tone]} </span>${escapeHtml(heading)}</span><div class="myc-callout-body">${bodyHtml}</div></aside>\n`
}
