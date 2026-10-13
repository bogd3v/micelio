import { describe, it, expect } from 'vitest'
import { resolveLink, resolveSectionLink } from '../app/helpers/links'

const localize = (path: string): string => `/es${path}`

describe('resolveLink', () => {
  it('keeps external links as they are', () => {
    expect(resolveLink('https://github.com/ale9420', localize)).toEqual({ href: 'https://github.com/ale9420', external: true })
    expect(resolveLink('mailto:hola@bogdev.com.co', localize).external).toBe(true)
  })

  it('localizes site paths and leaves in-page anchors alone', () => {
    expect(resolveLink('/blog', localize)).toEqual({ href: '/es/blog', external: false })
    expect(resolveLink(' #projects ', localize)).toEqual({ href: '#projects', external: false })
  })

  it('refuses any other scheme, protocol-relative URLs and values with control characters or spaces', () => {
    for (const url of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example', '/\\evil.example', 'java\nscript:x', '/blog post', 'projects', '']) {
      expect(resolveLink(url, localize), url).toBeNull()
    }
  })
})

describe('resolveSectionLink', () => {
  it('localizes a site path once', () => {
    expect(resolveSectionLink('/blog', '/es', localize)).toEqual({ href: '/es/blog', external: false })
    expect(resolveSectionLink('/es/blog', '/es', localize)).toEqual({ href: '/es/blog', external: false })
    expect(resolveSectionLink('/es', '/es', localize)).toEqual({ href: '/es', external: false })
    expect(resolveSectionLink('/espresso', '/es', localize)).toEqual({ href: '/es/espresso', external: false })
    expect(resolveSectionLink('/blog', '', path => path)).toEqual({ href: '/blog', external: false })
  })

  it('keeps http(s) and mailto, and refuses what could leave the site unseen', () => {
    expect(resolveSectionLink('https://example.com', '/es', localize)?.external).toBe(true)
    expect(resolveSectionLink('mailto:a@b.co', '/es', localize)?.external).toBe(true)
    expect(resolveSectionLink('//evil.example.com', '/es', localize)).toBeNull()
    expect(resolveSectionLink('/\\evil.example.com', '/es', localize)).toBeNull()
    expect(resolveSectionLink('javascript:alert(1)', '/es', localize)).toBeNull()
    expect(resolveSectionLink('\u0001javascript:alert(1)', '/es', localize)).toBeNull()
    expect(resolveSectionLink('java\tscript:alert(1)', '/es', localize)).toBeNull()
    expect(resolveSectionLink('/\t/evil.example.com', '/es', localize)).toBeNull()
    expect(resolveSectionLink('#anchor', '/es', localize)).toBeNull()
    expect(resolveSectionLink('  /blog\n', '/es', localize)).toEqual({ href: '/es/blog', external: false })
  })
})
