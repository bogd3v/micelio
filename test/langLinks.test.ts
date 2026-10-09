import { describe, expect, it } from 'vitest'
import { alternatePaths, rewriteLangLinks } from '../app/helpers/langLinks'

const head = [
  '<link rel="canonical" href="https://bogdev.com.co/blog/a">',
  '<link rel="alternate" hreflang="en" href="https://bogdev.com.co/blog/a">',
  '<link rel="alternate" hreflang="es" href="https://bogdev.com.co/es/blog/guia-a?x=1&amp;y=2">',
  '<link rel="alternate" hreflang="x-default" href="https://bogdev.com.co/blog/a">',
  '<link rel="alternate" type="application/rss+xml" href="https://bogdev.com.co/feed.xml">',
].join('')

describe('alternatePaths', () => {
  it('reads the path of each hreflang link and ignores x-default, feeds and canonical', () => {
    expect(alternatePaths(head)).toEqual({ en: '/blog/a', es: '/es/blog/guia-a?x=1&y=2' })
  })

  it('is empty without hreflang links', () => {
    expect(alternatePaths('<link rel="canonical" href="https://bogdev.com.co/blog/page/2">')).toEqual({})
  })
})

describe('rewriteLangLinks', () => {
  const anchors = '<a href="/es" class="myc-seg" data-myc-lang="es">ES</a><a aria-current="true" data-myc-lang="en" href="/blog/a" class="myc-seg">EN</a><a href="/about">About</a>'

  it('sets the href of each language link from the alternates', () => {
    expect(rewriteLangLinks(anchors, alternatePaths(head))).toBe(
      '<a href="/es/blog/guia-a?x=1&amp;y=2" class="myc-seg" data-myc-lang="es">ES</a><a aria-current="true" data-myc-lang="en" href="/blog/a" class="myc-seg">EN</a><a href="/about">About</a>',
    )
  })

  it('keeps the fallback of a language without an alternate', () => {
    expect(rewriteLangLinks(anchors, { en: '/blog/a' })).toBe(
      '<a href="/es" class="myc-seg" data-myc-lang="es">ES</a><a aria-current="true" data-myc-lang="en" href="/blog/a" class="myc-seg">EN</a><a href="/about">About</a>',
    )
  })

  it('leaves other markup alone', () => {
    expect(rewriteLangLinks('<p>hi</p>', { es: '/es' })).toBe('<p>hi</p>')
  })
})
