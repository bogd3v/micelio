import { defaultLocale, Locale } from '../interfaces/locale'

/** A redirect as the plugin's `GET /api/micelio/redirects` lists it: site paths without a locale prefix, and the page's locale or `null`. */
export interface RedirectRow {
  from: string
  to: string
  locale: string | null
}

/** The redirects of a site ready to answer: the path asked (with the locale prefix) to the path to send the visitor to. */
export interface ResolvedRedirects {
  /** Every chain resolved to its end. */
  paths: Map<string, string>
  /** A line for each row that was dropped, and why: a cycle, an address that leaves the site, a path a `_redirects` file would read as a pattern. */
  dropped: string[]
}

/** The most rules a `_redirects` file may hold on Cloudflare Pages (static ones). */
export const REDIRECTS_MAX_RULES = 2000

// One `/` first, then no second `/`, no backslash, no scheme, no space or control character: the plugin's own rule, checked again because this answers a 301
const SITE_PATH = /^\/(?![/\\])[^\\\s\p{Cc}]*$/u
// `*` and `:` are patterns in a `_redirects` file; `?` and `#` never reach a route
const LITERAL_PATH = /^[^*:?#]*$/

function prefixed(path: string, locale: Locale): string {
  // Not localizedPath(): this file is imported by a build module, where the ~ alias does not resolve
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  return path === '/' ? prefix || '/' : `${prefix}${path}`
}

/**
 * Turns the rows of the plugin into the redirects to answer: a path asked to a path to send the visitor to.
 *
 * @remarks
 * A row with a locale applies to that locale's paths (`/es/<from>` for Spanish); a row with `null` applies to every locale. A chain is resolved to its end, so a visitor takes one hop. A cycle (`/a` to `/b` to `/a`, or `/a` to itself) is dropped whole and reported in `dropped`, as is a row whose `from` or `to` is not a path of the site, whose locale the site does not serve, or whose `from` holds a character a `_redirects` file reads as a pattern.
 */
export function resolveRedirects(rows: readonly RedirectRow[]): ResolvedRedirects {
  const dropped: string[] = []
  const direct = new Map<string, string>()
  for (const { from, to, locale } of rows) {
    const locales = locale === null ? Object.values(Locale) : Object.values(Locale).filter(known => known === locale)
    if (!locales.length) dropped.push(`${from} to ${to}: the site does not serve the locale "${locale}"`)
    else if (!SITE_PATH.test(from) || !SITE_PATH.test(to)) dropped.push(`${from} to ${to}: not a path of the site`)
    else if (!LITERAL_PATH.test(from)) dropped.push(`${from} to ${to}: the source holds a pattern character`)
    else for (const each of locales) direct.set(prefixed(from, each), prefixed(to, each))
  }
  const paths = new Map<string, string>()
  const cycle = new Set<string>()
  for (const start of direct.keys()) {
    const seen = new Set([start])
    let end = direct.get(start)!
    while (direct.has(end) && !seen.has(end)) {
      seen.add(end)
      end = direct.get(end)!
    }
    if (direct.has(end)) {
      // `end` was seen: the walk came back to it, so everything from `start` on leads into a cycle
      for (const path of seen) cycle.add(path)
    } else paths.set(start, end)
  }
  for (const path of cycle) {
    paths.delete(path)
    dropped.push(`${path} to ${direct.get(path)}: part of a redirect cycle`)
  }
  return { paths, dropped }
}

/** The path a request for `pathname` is sent to, or `undefined`. A trailing slash is ignored. */
export function redirectTarget(paths: ReadonlyMap<string, string>, pathname: string): string | undefined {
  return paths.get(pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname)
}

/** The `_redirects` file (Cloudflare Pages, Netlify): one `/from /to 301` line each, in path order. Throws over the host limit. */
export function redirectsFile(paths: ReadonlyMap<string, string>): string {
  if (paths.size > REDIRECTS_MAX_RULES) throw new Error(`_redirects: ${paths.size} rules, over the ${REDIRECTS_MAX_RULES} that Cloudflare Pages accepts`)
  return [...paths].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([from, to]) => `${from} ${to} 301\n`).join('')
}
