import type { PreviewMode, WeightBlock, WeightReport } from '../interfaces/preview'
import { parseHeavyDeclaration } from './islands'

/** A file as a server sent it: the bytes on the wire (compressed when the server compressed it) and, for text, its content. */
export interface SentFile {
  sent: number
  text: string
}

/**
 * Fetches a file by absolute URL as a visitor's browser would, and answers `null` for a URL this measurement does not follow.
 *
 * @remarks
 * It throws for a file that should be there and is not: a weight that skips a declared asset would be an estimate.
 */
export type FetchSentFile = (url: string) => Promise<SentFile | null>

/** The bytes of a page, by kind, as `scripts/perf/measure.mjs` counts them, plus the eager images and what its islands load on demand. */
export interface PageBytes {
  html: number
  css: number
  js: number
  fonts: number
  images: number
  /** The script of the islands the page declares, loaded only once one is used; never part of the page's weight. */
  onDemand: number
}

// A font a stylesheet references, as `scripts/perf/measure.mjs` finds it
const FONT_URL = /url\(\s*['"]?([^'")]+\.(?:woff2?|ttf|otf))/g
// A file an island's script names: a relative or `/_islands/` path to a script or a WebAssembly module
const ISLAND_FILE = /["'`]((?:\.{1,2}\/|\/(?:[\w.-]+\/)*_islands\/)[\w./-]+\.(?:m?js|wasm))["'`]/g
/** The most files one island's graph may hold; a graph past it is a bug in the build, not a weight to report. */
const MAX_ISLAND_FILES = 80

/** Kilobytes (1024 bytes) with one decimal, rounded as `measure.mjs` rounds them. */
export function kb(bytes: number): number {
  return Math.round(bytes / 102.4) / 10
}

function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

/**
 * The scripts, stylesheets and preloaded fonts a page's HTML declares, as absolute URLs.
 *
 * @remarks
 * A `modulepreload` link counts as a script. Inline scripts and data blocks declare nothing.
 */
export function declaredAssets(html: string, pageUrl: string): { scripts: Set<string>, stylesheets: Set<string>, fonts: Set<string> } {
  const scripts = new Set<string>()
  const stylesheets = new Set<string>()
  const fonts = new Set<string>()
  for (const tag of html.match(/<script\b[^>]*>/g) ?? []) {
    const src = attribute(tag, 'src')
    if (src) scripts.add(new URL(src, pageUrl).href)
  }
  for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
    const href = attribute(tag, 'href')
    const rel = attribute(tag, 'rel')
    if (!href) continue
    if (rel === 'modulepreload') scripts.add(new URL(href, pageUrl).href)
    if (rel === 'stylesheet') stylesheets.add(new URL(href, pageUrl).href)
    if (rel === 'preload' && attribute(tag, 'as') === 'font') fonts.add(new URL(href, pageUrl).href)
  }
  return { scripts, stylesheets, fonts }
}

/**
 * The `src` of each `<img>` the browser loads without scrolling, as absolute URLs: every one not marked `loading="lazy"`.
 *
 * @remarks
 * A server cannot know which lazy images sit near the viewport, so it leaves them all out; `data:` URLs carry their own bytes and are left out too.
 */
export function eagerImages(html: string, pageUrl: string): string[] {
  const urls = new Set<string>()
  for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
    const src = attribute(tag, 'src')
    if (!src || src.startsWith('data:') || attribute(tag, 'loading') === 'lazy') continue
    urls.add(new URL(src.replaceAll('&amp;', '&'), pageUrl).href)
  }
  return [...urls]
}

/** The islands a page declares, as the absolute URL of each entry. */
export function islandEntries(html: string, pageUrl: string): string[] {
  const entries = new Set<string>()
  for (const match of html.matchAll(/<script\b[^>]*\sid="micelio-island-[^"]*"[^>]*>([\s\S]*?)<\/script>/g)) {
    const declaration = parseHeavyDeclaration(match[1])
    if (declaration) entries.add(new URL(declaration.src, pageUrl).href)
  }
  return [...entries]
}

/** The files under `/_islands/` that a script of an island names, resolved against the script's own URL. */
export function islandReferences(script: string, scriptUrl: string): string[] {
  const found = new Set<string>()
  for (const match of script.matchAll(ISLAND_FILE)) {
    const url = new URL(match[1] ?? '', scriptUrl)
    if (url.origin === new URL(scriptUrl).origin && url.pathname.includes('/_islands/')) found.add(url.href)
  }
  return [...found]
}

/** The fonts a stylesheet references, as absolute URLs. */
export function fontsOf(css: string, cssUrl: string): string[] {
  return [...css.matchAll(FONT_URL)].map(match => new URL(match[1] ?? '', cssUrl).href)
}

async function sentTotal(urls: Iterable<string>, fetchFile: FetchSentFile): Promise<{ bytes: number, texts: string[] }> {
  const files = await Promise.all([...urls].map(fetchFile))
  return files.reduce((sum, file) => file ? { bytes: sum.bytes + file.sent, texts: [...sum.texts, file.text] } : sum, { bytes: 0, texts: [] as string[] })
}

/**
 * The bytes the files of an island's graph add up to: its entry and every file they name, each distinct file once, as sent.
 *
 * @remarks
 * Only files a script names in a string are followed. A file the island builds its path for at run time (a runtime picked by language) is not, so the figure is what the entry and its chunks load, not an upper bound.
 *
 * @throws `Error` when the graph passes `MAX_ISLAND_FILES`.
 */
export async function islandBytes(entries: string[], fetchFile: FetchSentFile): Promise<number> {
  const seen = new Set<string>()
  let bytes = 0
  let queue = entries
  while (queue.length) {
    const next: string[] = []
    for (const url of queue) {
      if (seen.has(url)) continue
      seen.add(url)
      if (seen.size > MAX_ISLAND_FILES) throw new Error(`An island loads more than ${MAX_ISLAND_FILES} files`)
      const file = await fetchFile(url)
      if (!file) continue
      bytes += file.sent
      if (!url.endsWith('.wasm')) next.push(...islandReferences(file.text, url))
    }
    queue = next
  }
  return bytes
}

/**
 * Measures one rendered page: its HTML, the scripts, stylesheets and fonts it declares, its eager images and what its islands load on demand.
 *
 * @param page - The HTML as the server sent it.
 * @param pageUrl - The absolute URL the page was rendered at; relative references resolve against it.
 * @param alsoScripts - Absolute URLs of scripts to count besides the ones the page declares, each once.
 *
 * @remarks
 * The same measurement as `npm run perf`, on bytes as sent. The fonts are the preloaded ones plus every font the stylesheets reference.
 */
export async function measurePage(page: SentFile, pageUrl: string, fetchFile: FetchSentFile, alsoScripts: Iterable<string> = []): Promise<PageBytes> {
  const { scripts, stylesheets, fonts } = declaredAssets(page.text, pageUrl)
  for (const script of alsoScripts) scripts.add(script)
  const js = await sentTotal(scripts, fetchFile)
  const css = await sentTotal(stylesheets, fetchFile)
  ;[...stylesheets].forEach((cssUrl, index) => {
    for (const font of fontsOf(css.texts[index] ?? '', cssUrl)) fonts.add(font)
  })
  const [font, images, onDemand] = await Promise.all([
    sentTotal(fonts, fetchFile),
    sentTotal(eagerImages(page.text, pageUrl), fetchFile),
    islandBytes(islandEntries(page.text, pageUrl), fetchFile),
  ])
  return { html: page.sent, css: css.bytes, js: js.bytes, fonts: font.bytes, images: images.bytes, onDemand }
}

/** What a page weighs in the report: everything it sends at load, never the on-demand script. */
export function totalBytes(bytes: PageBytes): number {
  return bytes.html + bytes.css + bytes.js + bytes.fonts + bytes.images
}

/**
 * The report of a draft from its measurement and the measurements of the page without each block.
 *
 * @param blocks - The catalogue id of each block of the zone, in order.
 * @param without - For each block, the page rendered without it, in the same order; a block with none has a share of 0.
 * @param rendered - The page as the draft route renders it, which the `without` renders are taken from; `whole` itself when omitted.
 *
 * @remarks
 * A block's share is the difference between `rendered` and the page without it, so a stylesheet or script every page loads is in no block's share. Differences are taken on bytes and rounded once; a block cannot weigh less than 0.
 */
export function weightReport(mode: PreviewMode, whole: PageBytes, blocks: string[], without: PageBytes[], rendered: PageBytes = whole): WeightReport {
  const shares: WeightBlock[] = blocks.map((id, index) => {
    const rest = without[index] ?? rendered
    return { id, kb: kb(Math.max(0, totalBytes(rendered) - totalBytes(rest))), onDemandKb: kb(Math.max(0, rendered.onDemand - rest.onDemand)) }
  })
  return {
    mode,
    htmlKb: kb(whole.html),
    cssKb: kb(whole.css),
    jsKb: kb(whole.js),
    fontKb: kb(whole.fonts),
    imagesKb: kb(whole.images),
    totalKb: kb(totalBytes(whole)),
    onDemandKb: kb(whole.onDemand),
    blocks: shares,
  }
}
