// FOUC checks on a rendered page (docs/performance.md, "Per theme and site mode"). Pure: takes the HTML and the CSS texts.

const INIT_SCRIPT = /<script\b[^>]*>[^<]*setAttribute\('data-theme'/
const STYLE_START = /<link\b[^>]*\srel="stylesheet"|<style\b/

function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

/** Each @font-face as { family, sources (resolved URLs), sizeAdjust } */
export function fontFaces(css, baseUrl) {
  const faces = []
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = body.match(/font-family:\s*["']?([^;"']+)["']?\s*;/)?.[1]?.trim()
    if (!family) continue
    const sources = [...body.matchAll(/url\(\s*['"]?([^'")]+)/g)].map(([, url]) => new URL(url, baseUrl).href)
    faces.push({ family, sources, sizeAdjust: /size-adjust:/.test(body) })
  }
  return faces
}

/**
 * Problems that would show a flash of unstyled or reflowing content:
 * - the theme init script must be an inline script in the head before the first stylesheet;
 * - every preloaded font needs a `<family> Fallback` @font-face with size-adjust.
 * `stylesheets` maps each stylesheet URL to its text.
 */
export function checkFouc(html, pageUrl, stylesheets) {
  const problems = []
  const end = html.indexOf('</head>')
  const head = end === -1 ? html : html.slice(0, end)
  const init = head.search(INIT_SCRIPT)
  const style = head.search(STYLE_START)
  if (init === -1) problems.push('the theme init script is not an inline script in <head>')
  else if (style !== -1 && init > style) problems.push('the theme init script comes after the first stylesheet')

  const css = [...stylesheets].map(([href, text]) => ({ href, text }))
  for (const [, body] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) css.push({ href: pageUrl, text: body })
  const faces = css.flatMap(({ href, text }) => fontFaces(text, href))
  const preloaded = (head.match(/<link\b[^>]*>/g) ?? [])
    .filter(tag => attribute(tag, 'rel') === 'preload' && attribute(tag, 'as') === 'font' && attribute(tag, 'href'))
    .map(tag => new URL(attribute(tag, 'href'), pageUrl).href)
  for (const href of preloaded) {
    const path = new URL(href).pathname
    const served = faces.filter(f => f.sources.includes(href))
    if (!served.length) {
      problems.push(`preloaded font ${path} has no @font-face`)
      continue
    }
    for (const family of new Set(served.map(f => f.family))) {
      if (!faces.some(f => f.family === `${family} Fallback` && f.sizeAdjust)) {
        problems.push(`preloaded font ${path} ("${family}") has no size-adjusted "${family} Fallback" @font-face`)
      }
    }
  }
  return problems
}
