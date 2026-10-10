import { CATEGORIES } from '../constants/categories'
import { feedPath } from './feed'
import { localePrefixSource } from './localePrefix'
import { MODEL_MAX_BYTES } from '../islands/constants'
import { isGlb, isGlbUrl } from './scene'
import { SECURITY_HEADERS } from './securityHeaders'
import type { SpeculationRules } from './speculation'
import { defaultLocale, Locale } from '../interfaces/locale'

const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
const LINK_TAG = /<link\b([^>]*)>/gi
const NUXT_ASSET_JS = /\/_nuxt\/[^"'\s>]*\.m?js\b/
const NUXT_STATE = /__NUXT__|__NUXT_DATA__|data-nuxt-data/
const NUXT_PAYLOAD = /_payload\.json/

/**
 * What a static page must not carry (ADR 0006, section 3): Nuxt's entry or any `/_nuxt/*.js`,
 * its state and its payload. Looks only at `<script>` and `<link>` tags, so an article about Nuxt passes.
 *
 * Plan B if `noScripts` stops working in a Nuxt release: remove these tags in a `render:html` hook (ADR 0006, section 3).
 */
export function noScriptsViolations(html: string): string[] {
  const found = new Set<string>()
  for (const [, attributes = '', body = ''] of html.matchAll(SCRIPT_TAG)) {
    if (NUXT_ASSET_JS.test(attributes)) found.add('a script from /_nuxt/')
    if (NUXT_STATE.test(attributes) || NUXT_STATE.test(body)) found.add('the Nuxt state (__NUXT__)')
    if (NUXT_PAYLOAD.test(attributes) || NUXT_PAYLOAD.test(body)) found.add('a _payload.json')
  }
  for (const [, attributes = ''] of html.matchAll(LINK_TAG)) {
    if (NUXT_ASSET_JS.test(attributes)) found.add('a preload of /_nuxt/*.js')
    if (NUXT_PAYLOAD.test(attributes)) found.add('a preload of _payload.json')
  }
  return [...found]
}

/** Routes of the files that are not pages: the feeds, the sitemap and robots.txt, in every locale. A build with no blog has no feeds. */
export function staticFileRoutes(blogEnabled = true): string[] {
  const feeds = blogEnabled ? Object.values(Locale).flatMap(locale => [feedPath(locale), ...CATEGORIES.map(category => feedPath(locale, category))]) : []
  return [...feeds, '/sitemap.xml', '/robots.txt']
}

// Not localizedPath(): this file is imported by a build module, where the ~ alias does not resolve in type checking
function localized(path: string, locale: Locale): string {
  return locale === defaultLocale ? path : `/${locale}${path}`
}

export function articleRoute(slug: string, locale: Locale): string {
  return localized(`/blog/${slug}`, locale)
}

export function sectionPageRoute(slug: string, locale: Locale): string {
  return localized(`/${slug}`, locale)
}

/**
 * Routes every static site must have, whatever Strapi lists.
 *
 * @internal Exported for tests.
 */
export const STATIC_INITIAL_ROUTES: readonly string[] = ['/', '/es', '/blog', '/es/blog']

/** What a build with no blog (a landing with no articles) must not generate or crawl: the blog, its filters and its feeds, in every locale. */
export const BLOG_ROUTES = new RegExp(`^${localePrefixSource()}(?:/blog(?:/|$)|/feed(?:\\.xml|/))`)

/** The about page has no source in a landing with no blog (its links point at the blog); the crawler must not generate it. */
export const ABOUT_ROUTES = new RegExp(`^${localePrefixSource()}/about(?:/|$)`)

/** The routes every build must have: without a blog, only the home pages. */
export function initialRoutes(blogEnabled: boolean): string[] {
  return STATIC_INITIAL_ROUTES.filter(route => blogEnabled || !BLOG_ROUTES.test(route))
}

/**
 * Whether a route's error fails the build: anything but a 404 found by the crawler (a dead link in the content).
 * Routes the build asked for (Strapi's, the initial ones) must render, 404 included.
 */
export function failsBuild(route: string, statusCode: number | undefined, required: ReadonlySet<string>): boolean {
  return required.has(route) || statusCode !== 404
}

/** The required routes that were never prerendered (skipped, ignored or dropped). */
export function missingRoutes(required: Iterable<string>, prerendered: Iterable<string>): string[] {
  const done = new Set(prerendered)
  return [...required].filter(route => !done.has(route))
}

// Only real media tags: sanitized Markdown keeps literal quotes, so `&lt;img src="..."&gt;` in a code block must not match
// `<link rel="icon">` too: the site's favicon comes from Strapi and the static CSP allows no image origin
// `<micelio-scene data-model>` is the model the scene island fetches (ADR 0006, section 6)
const MEDIA_TAG = /<(?:(?:img|video|source|audio|micelio-scene)\b|link\b(?=[^>]*\brel="[^"]*\bicon\b))[^>]*>/gi
const MEDIA_ATTRIBUTE = /(\s(?:src|poster|href)=")([^"]+)(")/g
const SCENE_ATTRIBUTE = /(\sdata-model=")([^"]+)(")/g
const SCENE_TAG = /^<micelio-scene\b/i

// A scene's tag carries its model in `data-model` and nothing else; every other media tag its `src`, `poster` or `href`
function attributesOf(tag: string): RegExp {
  return SCENE_TAG.test(tag) ? SCENE_ATTRIBUTE : MEDIA_ATTRIBUTE
}

function decodeAmpersands(value: string): string {
  return value.replaceAll('&amp;', '&')
}

/**
 * Absolute `src`, `poster` and icon `href` URLs of media tags that start with one of the prefixes (the HTML-decoded form), in order of appearance.
 * Prefixes are `<strapi origin>/uploads/` and `<media origin>/`.
 */
export function mediaUrlsIn(html: string, prefixes: readonly string[]): string[] {
  const found = new Set<string>()
  for (const [tag] of html.matchAll(MEDIA_TAG)) {
    for (const [, , value = ''] of tag.matchAll(attributesOf(tag))) {
      const url = decodeAmpersands(value)
      if (prefixes.some(prefix => url.startsWith(prefix))) found.add(url)
    }
  }
  return [...found]
}

/** The same HTML with each URL of `local` (decoded URL to path on the site) replaced by its path, in media tags only. */
export function rewriteMediaUrls(html: string, local: ReadonlyMap<string, string>): string {
  return html.replace(MEDIA_TAG, tag => tag.replace(attributesOf(tag), (match, before: string, value: string, after: string) => {
    const path = local.get(decodeAmpersands(value))
    return path ? `${before}${path}${after}` : match
  }))
}

/** Whether a response may be copied into /_media/: an image, video or audio, or a binary glTF named `.glb` (checked by its bytes, since hosts send any type for it). */
export function isCopyableMedia(contentType: string, url: string, bytes: Uint8Array): boolean {
  if (/^(image|video|audio)\//.test(contentType)) return true
  return bytes.byteLength <= MODEL_MAX_BYTES && isGlbUrl(new URL(url).pathname) && isGlb(bytes)
}

/** A file name under /_media/ for a media URL: a short hash of the URL, then its safe base name. */
export function mediaFileName(url: string, hash: string): string {
  const base = new URL(url).pathname.split('/').pop() ?? 'file'
  return `${hash}-${base.replace(/[^\w.-]/g, '_')}`
}

// NuxtImg writes an inline `onerror` on the server; the hash CSP blocks inline handlers, so under it the attribute is dead weight
const NUXT_IMG_TAG = /<img\b[^>]*\bdata-nuxt-img\b[^>]*>/gi
const IMAGE_ERROR_HANDLER = / onerror="this\.setAttribute\(&#39;data-error&#39;, 1\)"/

/** The HTML without the inert `onerror` handler `@nuxt/image` adds to its images (only on `data-nuxt-img` tags). */
export function stripImageErrorHandlers(html: string): string {
  return html.replace(NUXT_IMG_TAG, tag => tag.replace(IMAGE_ERROR_HANDLER, ''))
}

/**
 * The HTML with the policy as `<meta http-equiv>` right after the charset in the `<head>` (or the `<head>` tag), for hosts without `_headers`.
 * Throws when there is no `<head>`: a page without the meta must not ship.
 */
export function injectCspMeta(html: string, policy: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">`
  const head = /<head(?:\s[^>]*)?>/i.exec(html)
  if (!head) throw new Error('no <head> to put the CSP meta in')
  const start = head.index + head[0].length
  const closing = html.indexOf('</head>', start)
  const inHead = html.slice(start, closing === -1 ? undefined : closing)
  const charset = /<meta charset="utf-8">/i.exec(inHead)
  const end = start + (charset ? charset.index + charset[0].length : 0)
  return `${html.slice(0, end)}${meta}${html.slice(end)}`
}

/**
 * The HTML with the Speculation Rules as one `<script type="speculationrules">` at the end of the `<head>` (ADR 0004 amendment).
 * Added to the generated pages, not rendered by the app: the error shell (`404.html`) has no app head, and every page must carry the same script.
 * A page that has the script already is left as it is. Throws when there is no `</head>`: a page without the rules would break the shared policy.
 */
export function injectSpeculationRules(html: string, rules: SpeculationRules): string {
  const end = html.indexOf('</head>')
  if (end === -1) throw new Error('no </head> to put the speculation rules in')
  if (html.includes('type="speculationrules"')) return html
  return `${html.slice(0, end)}<script type="speculationrules">${JSON.stringify(rules)}</script>${html.slice(end)}`
}

/** The routes whose inline-script hashes differ from the most common set among the pages (empty when all agree). */
export function scriptHashDisagreements(pages: ReadonlyMap<string, readonly string[]>): string[] {
  const key = (hashes: readonly string[]): string => [...new Set(hashes)].sort().join(' ')
  const counts = new Map<string, number>()
  for (const hashes of pages.values()) counts.set(key(hashes), (counts.get(key(hashes)) ?? 0) + 1)
  const common = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  return [...pages].filter(([, hashes]) => key(hashes) !== common).map(([route]) => route)
}

const IMMUTABLE = 'public, max-age=31536000, immutable'
const REVALIDATE = 'public, max-age=0, must-revalidate'
/** Strapi keeps a file's URL when it is replaced, so `_ipx` (named after the source URL) revalidates; `_nuxt` (Vite hash) and `_media` (byte hash) never change under a name. */
/** `_islands` files carry a content hash in the name. */
const IMMUTABLE_PATHS: readonly string[] = ['/_nuxt/*', '/_media/*', '/_islands/*']
/** `/pagefind/*` is rebuilt with every generate (`pagefind.js` keeps its name), so it is never immutable. */
const REVALIDATED_PATHS: readonly string[] = ['/_ipx/*', '/pagefind/*']
/** Files copied from Strapi are data, never documents: an SVG opened directly runs nothing and loads nothing. Sent on top of the site policy (repeated policies only tighten). */
const WORKERS_PATH = '/_islands/workers/*'
const MEDIA_POLICY = 'default-src \'none\'; style-src \'unsafe-inline\'; img-src \'self\' data:; sandbox'

// Cloudflare Pages limits (docs): 100 rules, 2000 characters per line
const HEADERS_MAX_RULES = 100
const HEADERS_MAX_LINE = 2000

function headerName(name: string): string {
  return name.replace(/(^|-)([a-z])/g, (_match, dash: string, letter: string) => `${dash}${letter.toUpperCase()}`)
}

/** The `_headers` file (Cloudflare Pages, Netlify): the policy and the fixed security headers on every path, cache rules on assets. Throws over the host limits. */
export function headersFile(policy: string, workerPolicy?: string): string {
  const everything = Object.entries({ 'content-security-policy': policy, ...SECURITY_HEADERS })
    .map(([name, value]) => `  ${headerName(name)}: ${value}`)
  const rules = [
    ['/*', ...everything],
    ...IMMUTABLE_PATHS.map(path => [path, `  Cache-Control: ${IMMUTABLE}`]),
    ...REVALIDATED_PATHS.map(path => [path, `  Cache-Control: ${REVALIDATE}`]),
    ['/_media/*', `  Content-Security-Policy: ${MEDIA_POLICY}`],
    // A Worker takes its policy from its own response; repeated policies only tighten, so this narrows the site's (ADR 0004)
    ...(workerPolicy ? [[WORKERS_PATH, `  Content-Security-Policy: ${workerPolicy}`]] : []),
  ]
  // `/_media/*` appears twice on purpose: two rules, two header sets
  const merged = rules.reduce<string[][]>((all, rule) => {
    const same = all.find(other => other[0] === rule[0])
    if (same) same.push(...rule.slice(1))
    else all.push([...rule])
    return all
  }, [])
  const lines = merged.flat()
  const long = lines.find(line => line.length > HEADERS_MAX_LINE)
  if (long) throw new Error(`_headers: a line has ${long.length} characters, over the ${HEADERS_MAX_LINE} that Cloudflare Pages accepts (${long.slice(0, 60)}...)`)
  if (merged.length > HEADERS_MAX_RULES) throw new Error(`_headers: ${merged.length} rules, over the ${HEADERS_MAX_RULES} that Cloudflare Pages accepts`)
  return `${merged.map(rule => rule.join('\n')).join('\n\n')}\n`
}

const SCRIPT_NAME = /[\w$.-]+\.js/g

/**
 * The `_nuxt` scripts that nothing reaches: not named by a page, a stylesheet, an island or another kept script.
 * `scripts` maps a file name to its text; `roots` is the text of everything that may load one (HTML, CSS, islands).
 */
export function unreachableScripts(scripts: ReadonlyMap<string, string>, roots: Iterable<string>): string[] {
  const reached = new Set<string>()
  const queue: string[] = []
  const visit = (text: string): void => {
    for (const [name] of text.matchAll(SCRIPT_NAME)) {
      if (scripts.has(name) && !reached.has(name)) {
        reached.add(name)
        queue.push(name)
      }
    }
  }
  for (const text of roots) visit(text)
  for (let name = queue.pop(); name !== undefined; name = queue.pop()) visit(scripts.get(name) ?? '')
  return [...scripts.keys()].filter(name => !reached.has(name)).sort()
}

/**
 * What a landing needs from its home pages (docs/static-mode.md, "Landing"): with no articles, the home page is all there is,
 * so a language without one fails the build; with articles the blog home answers, so it is only a warning.
 */
export function landingHomeCheck(blogEnabled: boolean, missing: readonly string[]): { error?: string, warning?: string } {
  if (!missing.length) return {}
  const locales = missing.join(', ')
  if (!blogEnabled) return { error: `Site mode "landing": no published articles and no homePage for ${locales}; set one in the site settings` }
  return { warning: `Site mode "landing": no homePage for ${locales}, so / shows the blog home there; set one in the site settings` }
}
