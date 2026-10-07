import { CATEGORIES } from './categories'
import { feedPath } from './feed'
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

/** Routes of the files that are not pages: the feeds, the sitemap and robots.txt, in every locale. */
export function staticFileRoutes(): string[] {
  const feeds = Object.values(Locale).flatMap(locale => [feedPath(locale), ...CATEGORIES.map(category => feedPath(locale, category))])
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
