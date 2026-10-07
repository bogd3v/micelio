import type { TextSegment } from '../interfaces/design'

const TAG = /<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ' }

function decode(text: string): string {
  return text.replace(ENTITY, (whole, entity: string) => {
    const lower = entity.toLowerCase()
    if (lower.startsWith('#')) {
      const code = lower.startsWith('#x') ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10)
      return Number.isInteger(code) && code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : whole
    }
    return NAMED[lower] ?? whole
  })
}

/**
 * Pagefind excerpts are HTML with `<mark>` around the matches. Only `<mark>` survives: every other tag is dropped and
 * the text comes back decoded, to be set as text, never as HTML.
 */
export function excerptSegments(html: string): TextSegment[] {
  const segments: TextSegment[] = []
  let match = false
  let cursor = 0

  function push(raw: string): void {
    const text = decode(raw)
    if (!text) return
    const last = segments.at(-1)
    if (last && last.match === match) last.text += text
    else segments.push({ text, match })
  }

  for (const tag of html.matchAll(TAG)) {
    push(html.slice(cursor, tag.index))
    cursor = tag.index + tag[0].length
    if (tag[2]!.toLowerCase() === 'mark') match = tag[1] !== '/'
  }
  push(html.slice(cursor))
  return segments
}

/** The text of an HTML fragment (a Pagefind title may carry entities such as `&amp;`): tags dropped, entities decoded. */
export function plainText(html: string): string {
  return excerptSegments(html).map(segment => segment.text).join('')
}
