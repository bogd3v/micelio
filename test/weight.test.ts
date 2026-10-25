import { brotliCompressSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { declaredAssets, eagerImages, fontsOf, islandBytes, islandEntries, islandReferences, kb, measurePage, totalBytes, weightReport } from '../app/helpers/weight'
import type { FetchSentFile, PageBytes, SentFile } from '../app/helpers/weight'

const PAGE = 'https://site.test/drafts/pages/doc-1?locale=en'

const DECLARATION = JSON.stringify({ id: 'scene', trigger: 'visible', saveData: 'skip', src: '/_islands/scene-abc123.js', features: ['webgl2'] })

/** A page of three blocks, one of them an island: a hero with an eager image, a rich text, a scene. */
function html(blocks: Array<'hero' | 'text' | 'scene'>): string {
  const parts = blocks.map((block) => {
    if (block === 'hero') return '<section class="myc-hero"><img src="/uploads/hero.webp" alt="" width="400" height="300"></section>'
    if (block === 'scene') return `<micelio-scene><img src="/uploads/poster.webp" alt="" loading="lazy"></micelio-scene><script type="application/json" id="micelio-island-scene">${DECLARATION}</script><script type="module" src="/_islands/loader-def456.js"></script>`
    return '<section class="myc-prose"><p>Some text.</p></section>'
  })
  return `<!doctype html><html><head>
<link rel="preload" as="font" href="/fonts/body.woff2" crossorigin>
<link rel="stylesheet" href="/_t/digest/theme.css">
<link rel="modulepreload" as="script" href="/_nuxt/entry.js">
<script>document.documentElement.dataset.theme = 'day'</script>
<script type="application/json" id="nuxt-data">{"a":1}</script>
</head><body>${parts.join('')}<script type="module" src="/_nuxt/entry.js"></script></body></html>`
}

const FILES: Record<string, SentFile> = {
  '/fonts/body.woff2': { sent: 20_000, text: '' },
  '/_t/digest/theme.css': { sent: 8_000, text: '@font-face{src:url("/fonts/display.woff2") format("woff2")} .a{background:url(/img/x.png)}' },
  '/fonts/display.woff2': { sent: 15_000, text: '' },
  '/_nuxt/entry.js': { sent: 50_000, text: 'export {}' },
  '/_islands/loader-def456.js': { sent: 2_000, text: 'import("/_islands/scene-abc123.js")' },
  '/uploads/hero.webp': { sent: 30_000, text: '' },
  '/uploads/poster.webp': { sent: 9_000, text: '' },
  '/_islands/scene-abc123.js': { sent: 6_000, text: 'import{a}from"./chunks/engine-aa11.js";const m=new URL("../models/x.glb",import.meta.url)' },
  '/_islands/chunks/engine-aa11.js': { sent: 120_000, text: 'import("./engine-bb22.js")' },
  '/_islands/chunks/engine-bb22.js': { sent: 4_000, text: '"use strict"' },
}

/** Counts what it was asked for, so a test can see that a file is fetched once. */
function fetcher(files: Record<string, SentFile> = FILES): { fetchFile: FetchSentFile, asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    fetchFile: async (url) => {
      asked.push(url)
      const file = files[new URL(url).pathname]
      if (!file) throw new Error(`no ${url}`)
      return file
    },
  }
}

describe('kb', () => {
  it('rounds bytes to a tenth of a KB of 1024 bytes, as measure.mjs does', () => {
    expect(kb(0)).toBe(0)
    expect(kb(1024)).toBe(1)
    expect(kb(1536)).toBe(1.5)
    expect(kb(150_000)).toBe(146.5)
    expect(kb(50)).toBe(0)
    expect(kb(52)).toBe(0.1)
  })
})

describe('declaredAssets', () => {
  it('lists the scripts, modulepreloads, stylesheets and preloaded fonts as absolute URLs, and nothing inline', () => {
    const { scripts, stylesheets, fonts } = declaredAssets(html(['hero', 'scene']), PAGE)
    expect([...scripts]).toEqual(['https://site.test/_islands/loader-def456.js', 'https://site.test/_nuxt/entry.js'])
    expect([...stylesheets]).toEqual(['https://site.test/_t/digest/theme.css'])
    expect([...fonts]).toEqual(['https://site.test/fonts/body.woff2'])
  })
})

describe('fontsOf', () => {
  it('finds each font a stylesheet references and resolves it against the stylesheet', () => {
    expect(fontsOf('@font-face{src:url(a.woff2)}@font-face{src:url( "../b/c.ttf" )} .x{background:url(i.png)}', 'https://site.test/_t/d/theme.css')).toEqual(['https://site.test/_t/d/a.woff2', 'https://site.test/_t/b/c.ttf'])
  })
})

describe('eagerImages', () => {
  it('keeps the images not marked lazy and leaves data URLs out', () => {
    const tags = '<img src="/a.webp"><img src="/b.webp" loading="lazy"><img src="data:image/gif;base64,AAAA"><img alt=""><img src="/c.webp?w=1&amp;h=2" loading="eager"><img src="/a.webp">'
    expect(eagerImages(tags, PAGE)).toEqual(['https://site.test/a.webp', 'https://site.test/c.webp?w=1&h=2'])
  })
})

describe('islandEntries', () => {
  it('reads the entry of each declared island and skips a declaration that points anywhere else', () => {
    expect(islandEntries(html(['scene']), PAGE)).toEqual(['https://site.test/_islands/scene-abc123.js'])
    const forged = `<script type="application/json" id="micelio-island-scene">${JSON.stringify({ id: 'scene', trigger: 'visible', src: 'https://evil.test/x.js' })}</script>`
    expect(islandEntries(forged, PAGE)).toEqual([])
    expect(islandEntries(html(['hero', 'text']), PAGE)).toEqual([])
  })
})

describe('islandReferences', () => {
  it('follows a relative or absolute path under /_islands/ to a script or a module and ignores the rest', () => {
    const text = 'import a from"./a.js";import("../runtimes/sql-9.js");new URL("/_islands/runtimes/x.wasm",e);fetch("/api/x.js");import"./data.json";import("https://cdn.test/_islands/y.js")'
    expect(islandReferences(text, 'https://site.test/_islands/chunks/entry.js')).toEqual([
      'https://site.test/_islands/chunks/a.js',
      'https://site.test/_islands/runtimes/sql-9.js',
      'https://site.test/_islands/runtimes/x.wasm',
    ])
  })
})

describe('islandBytes', () => {
  it('adds the entry and every file it names, each file once, as sent', async () => {
    const { fetchFile, asked } = fetcher()
    expect(await islandBytes(['https://site.test/_islands/scene-abc123.js'], fetchFile)).toBe(6_000 + 120_000 + 4_000)
    expect(asked).toEqual(['scene-abc123', 'chunks/engine-aa11', 'chunks/engine-bb22'].map(name => `https://site.test/_islands/${name}.js`))
    expect(await islandBytes([], fetchFile)).toBe(0)
  })

  it('does not read a WebAssembly module as text and does not loop on a cycle', async () => {
    const files: Record<string, SentFile> = {
      '/_islands/a.js': { sent: 10, text: 'import"./b.js";import"./m.wasm"' },
      '/_islands/b.js': { sent: 20, text: 'import"./a.js"' },
      '/_islands/m.wasm': { sent: 300, text: 'import"./never.js"' },
    }
    const { fetchFile, asked } = fetcher(files)
    expect(await islandBytes(['https://site.test/_islands/a.js'], fetchFile)).toBe(330)
    expect(asked).toEqual(['https://site.test/_islands/a.js', 'https://site.test/_islands/b.js', 'https://site.test/_islands/m.wasm'])
  })

  it('stops at a graph that is not a plausible island', async () => {
    const files: Record<string, SentFile> = {}
    for (let i = 0; i < 100; i++) files[`/_islands/f${i}.js`] = { sent: 1, text: `import"./f${i + 1}.js"` }
    await expect(islandBytes(['https://site.test/_islands/f0.js'], fetcher(files).fetchFile)).rejects.toThrow('more than 80 files')
  })
})

describe('measurePage', () => {
  it('counts the HTML as sent, each declared asset, the fonts a stylesheet references, the eager images and the island apart', async () => {
    const page = html(['hero', 'text', 'scene'])
    const { fetchFile, asked } = fetcher()
    const bytes = await measurePage({ sent: 4_000, text: page }, PAGE, fetchFile)
    expect(bytes).toEqual({ html: 4_000, js: 50_000 + 2_000, css: 8_000, fonts: 20_000 + 15_000, images: 30_000, onDemand: 6_000 + 120_000 + 4_000 })
    expect(totalBytes(bytes)).toBe(4_000 + 52_000 + 8_000 + 35_000 + 30_000)
    // The lazy poster is not fetched; the entry is both a modulepreload and a script and is fetched once
    expect(asked.filter(url => url.endsWith('poster.webp'))).toEqual([])
    expect(asked.filter(url => url.endsWith('/_nuxt/entry.js'))).toHaveLength(1)
  })

  it('skips an image the fetcher does not follow, and fails on a declared script it cannot read', async () => {
    const page = html(['hero'])
    const { fetchFile } = fetcher()
    const skipping: FetchSentFile = async url => url.endsWith('hero.webp') ? null : fetchFile(url)
    expect((await measurePage({ sent: 1000, text: page }, PAGE, skipping)).images).toBe(0)
    const without = Object.fromEntries(Object.entries(FILES).filter(([path]) => path !== '/_nuxt/entry.js'))
    await expect(measurePage({ sent: 1000, text: page }, PAGE, fetcher(without).fetchFile)).rejects.toThrow('no https://site.test/_nuxt/entry.js')
  })

  it('counts the scripts it is given besides the declared ones, each once, and fails on one it cannot read', async () => {
    const files: Record<string, SentFile> = { ...FILES, '/_nuxt/route.js': { sent: 9_000, text: '' } }
    const { fetchFile, asked } = fetcher(files)
    const bytes = await measurePage({ sent: 4_000, text: html(['text']) }, PAGE, fetchFile, ['https://site.test/_nuxt/route.js', 'https://site.test/_nuxt/entry.js'])
    expect(bytes.js).toBe(50_000 + 9_000)
    expect(asked.filter(url => url.endsWith('/_nuxt/entry.js'))).toHaveLength(1)
    await expect(measurePage({ sent: 1, text: html(['text']) }, PAGE, fetchFile, ['https://site.test/_nuxt/missing.js'])).rejects.toThrow('no https://site.test/_nuxt/missing.js')
  })

  it('counts bytes as the server sent them, so a compressed asset weighs its compressed size', async () => {
    const script = 'export const x = "' + 'a'.repeat(5000) + '"'
    const compressed = brotliCompressSync(script).length
    const files: Record<string, SentFile> = { '/_nuxt/entry.js': { sent: compressed, text: script }, '/_t/digest/theme.css': { sent: 1, text: '' } }
    const bytes = await measurePage({ sent: 10, text: html(['text']) }, PAGE, fetcher({ ...FILES, ...files }).fetchFile)
    expect(bytes.js).toBe(compressed)
    expect(compressed).toBeLessThan(script.length)
  })
})

describe('weightReport', () => {
  const whole: PageBytes = { html: 4_000, css: 8_000, js: 52_000, fonts: 35_000, images: 30_000, onDemand: 130_000 }

  it('gives the totals in KB, with the on-demand script apart from the total', () => {
    const report = weightReport('dynamic', whole, [], [])
    expect(report).toEqual({ mode: 'dynamic', htmlKb: 3.9, cssKb: 7.8, jsKb: 50.8, fontKb: 34.2, imagesKb: 29.3, totalKb: 126, onDemandKb: 127, blocks: [] })
    expect(kb(totalBytes(whole))).toBe(report.totalKb)
  })

  it('takes a block\'s share as the difference with the page rendered without it', () => {
    // hero (an image and markup), text (markup only), scene (markup, a loader and an island)
    const withoutHero: PageBytes = { ...whole, html: 3_500, images: 0 }
    const withoutText: PageBytes = { ...whole, html: 3_800 }
    const withoutScene: PageBytes = { ...whole, html: 3_700, js: 50_000, onDemand: 0 }
    const report = weightReport('dynamic', whole, ['hero', 'rich-text', 'scene'], [withoutHero, withoutText, withoutScene])
    expect(report.blocks).toEqual([
      { id: 'hero', kb: kb(30_500), onDemandKb: 0 },
      { id: 'rich-text', kb: kb(200), onDemandKb: 0 },
      { id: 'scene', kb: kb(2_300), onDemandKb: kb(130_000) },
    ])
    expect(report.blocks.map(block => block.id)).toEqual(['hero', 'rich-text', 'scene'])
  })

  it('takes the shares from the draft route\'s own measurement while the totals are the page\'s', () => {
    const page: PageBytes = { ...whole, js: whole.js + 12_000 }
    const withoutHero: PageBytes = { ...whole, html: 3_500, images: 0 }
    const report = weightReport('dynamic', page, ['hero'], [withoutHero], whole)
    expect(report.jsKb).toBe(kb(64_000))
    expect(report.totalKb).toBe(kb(totalBytes(page)))
    // Taken from `page` the share would include the 12 KB of script the draft route does not have
    expect(report.blocks).toEqual([{ id: 'hero', kb: kb(30_500), onDemandKb: 0 }])
  })

  it('never reports a negative share', () => {
    const heavier: PageBytes = { ...whole, html: 9_000, onDemand: 200_000 }
    expect(weightReport('static', whole, ['hero'], [heavier]).blocks).toEqual([{ id: 'hero', kb: 0, onDemandKb: 0 }])
  })
})
