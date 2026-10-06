import { describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM script without types
import { checkFouc } from '../scripts/perf/fouc.mjs'

const PAGE = 'http://x.test/'
const INIT = `<script>(function(){document.documentElement.setAttribute('data-theme','a')})()</script>`
const FACE = '@font-face { font-family: "Sans"; src: url(/fonts/sans.woff2) format("woff2"); }'
const FALLBACK = '@font-face { font-family: "Sans Fallback"; src: local("Arial"); size-adjust: 96%; }'
const SHEET = 'http://x.test/_nuxt/a.css'
const PRELOAD = '<link rel="preload" as="font" href="/fonts/sans.woff2">'
const LINK = '<link rel="stylesheet" href="/_nuxt/a.css">'
const page = (head: string): string => `<html><head>${head}</head><body></body></html>`

describe('checkFouc', () => {
  it('passes when the init script leads and the font has a sized fallback', () => {
    const html = page(`${INIT}${PRELOAD}${LINK}`)
    expect(checkFouc(html, PAGE, new Map([[SHEET, `${FACE}\n${FALLBACK}`]]))).toEqual([])
  })

  it('fails when a stylesheet comes before the init script', () => {
    const html = page(`${LINK}${INIT}${PRELOAD}`)
    expect(checkFouc(html, PAGE, new Map([[SHEET, `${FACE}\n${FALLBACK}`]]))).toEqual(['the theme init script comes after the first stylesheet'])
  })

  it('fails without an init script', () => {
    const html = page(`${PRELOAD}${LINK}`)
    expect(checkFouc(html, PAGE, new Map([[SHEET, `${FACE}\n${FALLBACK}`]]))).toEqual(['the theme init script is not an inline script in <head>'])
  })

  it('fails when the fallback is missing or not size-adjusted', () => {
    const html = page(`${INIT}${PRELOAD}${LINK}`)
    const bare = new Map([[SHEET, `${FACE}\n${FALLBACK.replace('size-adjust: 96%;', '')}`]])
    expect(checkFouc(html, PAGE, bare)[0]).toContain('no size-adjusted "Sans Fallback"')
    expect(checkFouc(html, PAGE, new Map([[SHEET, FACE]]))[0]).toContain('no size-adjusted "Sans Fallback"')
  })

  it('requires a fallback for every family a font file serves', () => {
    const html = page(`${INIT}${PRELOAD}${LINK}`)
    const shared = '@font-face { font-family: "Symbols"; src: url(/fonts/sans.woff2); }'
    const css = `${FACE}\n${shared}\n${FALLBACK}`
    expect(checkFouc(html, PAGE, new Map([[SHEET, css]]))).toEqual(['preloaded font /fonts/sans.woff2 ("Symbols") has no size-adjusted "Symbols Fallback" @font-face'])
  })

  it('fails when a preloaded font has no @font-face', () => {
    const html = page(`${INIT}<link rel="preload" as="font" href="/fonts/other.woff2">${LINK}`)
    expect(checkFouc(html, PAGE, new Map([[SHEET, `${FACE}\n${FALLBACK}`]]))[0]).toContain('has no @font-face')
  })
})
