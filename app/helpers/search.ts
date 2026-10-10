import type { TextSegment } from '../interfaces/design'

/** The text in lower case, without accents and surrounding spaces, for comparing labels with a query. */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Whether a label contains the query, ignoring case and accents. An empty query matches every label. */
export function matchesQuery(label: string, query: string): boolean {
  const needle = normalizeText(query)
  return needle === '' || normalizeText(label).includes(needle)
}

/**
 * The index reached by moving `delta` steps from `current`, wrapping around at the ends, or -1 when there is nothing to pick.
 *
 * @remarks
 * From no selection (`current` of -1), a forward step gives the first index and a backward step gives the last.
 *
 * @param current - The current index, or -1 for no selection.
 * @param total - The number of items.
 * @param delta - The steps to move. Its sign gives the direction, so 1 is the next item and -1 the previous one.
 */
export function cycleIndex(current: number, total: number, delta: number): number {
  if (total === 0) return -1
  if (current < 0) return delta > 0 ? 0 : total - 1
  return (current + delta + total) % total
}

/** A count or an index with two digits, such as `03`. Larger numbers keep all their digits. */
export function padCount(count: number): string {
  return String(count).padStart(2, '0')
}

/**
 * The text split into segments, each marked when it matches the query. Matching ignores case but not accents.
 *
 * @remarks
 * An empty text gives no segments. An empty query gives the whole text as one unmarked segment.
 */
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
 * A Pagefind result URL as the site writes its links: no trailing slash on the path (`/blog/a/` becomes `/blog/a`, `/` stays).
 * Undefined unless it is a path of this site: it must start with `/`, not `//` or `/\`.
 */
export function resultPath(url: string): string | undefined {
  if (!/^\/(?![/\\])/.test(url)) return undefined
  const [path = '', ...rest] = url.split(/(?=[?#])/)
  return `${path.length > 1 ? path.replace(/\/+$/, '') : path}${rest.join('')}`
}

const TRUE_VALUES = new Set(['1', 'true'])

/** Whether a `content` query value turns on content search: `1` or `true`, in any case. */
export function isContentSearch(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && TRUE_VALUES.has(raw.trim().toLowerCase())
}
