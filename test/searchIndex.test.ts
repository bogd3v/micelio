import { describe, expect, it } from 'vitest'
import { indexablePage, indexedPages } from '~/helpers/searchIndex'

describe('indexablePage', () => {
  it('finds the body marker and the language', () => {
    expect(indexablePage('<!DOCTYPE html><html  lang="es" data-theme="noche"><body><article data-pagefind-body="" data-pagefind-meta="kind:article">x</article>')).toEqual({ body: true, lang: 'es' })
    expect(indexablePage('<html lang=en-US><body><p data-pagefind-body>x</p>')).toEqual({ body: true, lang: 'en-US' })
  })

  it('reports pages with no marker or no language', () => {
    expect(indexablePage('<html lang="en"><body><main>no marker</main>')).toEqual({ body: false, lang: 'en' })
    expect(indexablePage('<html><body><p data-pagefind-body="">x</p>')).toEqual({ body: true, lang: undefined })
    expect(indexablePage('<p>a fragment with data-pagefind-bodyx</p>')).toEqual({ body: false, lang: undefined })
  })
})

describe('indexedPages', () => {
  it('reads the page count of each language', () => {
    expect(indexedPages({ languages: { en: { page_count: 3 }, es: { page_count: 2 }, xx: {} } })).toEqual({ en: 3, es: 2, xx: 0 })
    expect(indexedPages({})).toEqual({})
  })
})
