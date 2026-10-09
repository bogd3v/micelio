import type { TextSegment } from '../interfaces/design'

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function matchesQuery(label: string, query: string): boolean {
  const needle = normalizeText(query)
  return needle === '' || normalizeText(label).includes(needle)
}

export function cycleIndex(current: number, total: number, delta: number): number {
  if (total === 0) return -1
  if (current < 0) return delta > 0 ? 0 : total - 1
  return (current + delta + total) % total
}

export function padCount(count: number): string {
  return String(count).padStart(2, '0')
}

export function highlightSegments(text: string, query: string): TextSegment[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!text || needle.length === 0) return text ? [{ text, match: false }] : []

  const haystack = text.toLocaleLowerCase()
  const segments: TextSegment[] = []
  let cursor = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    if (index > cursor) segments.push({ text: text.slice(cursor, index), match: false })
    segments.push({ text: text.slice(index, index + needle.length), match: true })
    cursor = index + needle.length
    index = haystack.indexOf(needle, cursor)
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false })
  return segments
}

/**
 * A Pagefind result URL as the site writes its links: no trailing slash on the path (`/blog/a/` -> `/blog/a`, `/` stays).
 * Undefined unless it is a path of this site: it must start with `/`, not `//` or `/\`.
 */
export function resultPath(url: string): string | undefined {
  if (!/^\/(?![/\\])/.test(url)) return undefined
  const [path = '', ...rest] = url.split(/(?=[?#])/)
  return `${path.length > 1 ? path.replace(/\/+$/, '') : path}${rest.join('')}`
}

const TRUE_VALUES = new Set(['1', 'true'])

export function isContentSearch(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && TRUE_VALUES.has(raw.trim().toLowerCase())
}
