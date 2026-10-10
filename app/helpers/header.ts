import type { HeaderSection } from '../interfaces/design'

const LOCALE_PREFIX = /^\/(en|es)(?=\/|$)/

function stripLocale(path: string): string {
  const bare = path.replace(LOCALE_PREFIX, '').replace(/\/+$/, '')
  return bare || '/'
}

/** The header section a path belongs to (`home`, `blog` or `about`), ignoring the locale prefix; undefined for any other path. */
export function headerSection(path: string): HeaderSection | undefined {
  const bare = stripLocale(path)
  if (bare === '/') return 'home'
  if (bare === '/blog' || bare.startsWith('/blog/')) return 'blog'
  if (bare === '/about' || bare.startsWith('/about/')) return 'about'
  return undefined
}

/** Whether a path is one article or draft page (`/blog/<slug>` or `/drafts/<id>`), with or without a locale prefix. */
export function isReadingPath(path: string): boolean {
  return /^\/(blog|drafts)\/[^/]+$/.test(stripLocale(path))
}

/**
 * How much of the page has been scrolled, as an integer from 0 to 100.
 *
 * @remarks
 * Answers 0 when the page is not taller than the viewport. The three arguments are in the same unit.
 */
export function readingPercent(scrollTop: number, scrollHeight: number, viewportHeight: number): number {
  const max = scrollHeight - viewportHeight
  if (max <= 0) return 0
  return Math.round(Math.min(100, Math.max(0, (scrollTop / max) * 100)))
}

/** The text around the number of a translated message, so CSS can draw the number between them. */
export function splitAroundNumber(message: string, marker: string): [string, string] {
  const at = message.indexOf(marker)
  return at < 0 ? [message, ''] : [message.slice(0, at), message.slice(at + marker.length)]
}
