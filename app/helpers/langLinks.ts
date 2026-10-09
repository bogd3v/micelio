/** Static language links: SSR renders them before the page knows its translations, so the head's hreflang links fill them in. */

const LINK_TAG = /<link\b[^>]*>/g
const LANG_ANCHOR = /<a\b[^>]*\sdata-myc-lang="([\w-]+)"[^>]*>/g

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]
}

/** The path of each `<link rel="alternate" hreflang href>` of a head, by language (x-default excluded). */
export function alternatePaths(head: string): Record<string, string> {
  const paths: Record<string, string> = {}
  for (const tag of head.match(LINK_TAG) ?? []) {
    const lang = attribute(tag, 'hreflang')
    const href = attribute(tag, 'href')
    if (attribute(tag, 'rel') !== 'alternate' || !lang || lang === 'x-default' || !href) continue
    try {
      const url = new URL(href.replaceAll('&amp;', '&'), 'http://localhost')
      paths[lang] = `${url.pathname}${url.search}`
    } catch {
      // not a URL: keep the anchor's own fallback
    }
  }
  return paths
}

/** Sets the href of every `data-myc-lang` anchor that has an alternate; the others keep the fallback they were rendered with. */
export function rewriteLangLinks(html: string, paths: Record<string, string>): string {
  if (!html.includes('data-myc-lang=')) return html
  return html.replace(LANG_ANCHOR, (tag, lang: string) => {
    const path = paths[lang]
    if (!path) return tag
    const href = path.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    return tag.replace(/\shref="[^"]*"/, ` href="${href}"`)
  })
}
