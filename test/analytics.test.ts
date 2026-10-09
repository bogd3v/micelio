import { describe, it, expect } from 'vitest'
import { isUmamiProxyPath, outboundLinkUrl, umamiScriptAttributes } from '../app/helpers/analytics'

const ORIGIN = 'https://bogdev.com.co'

describe('umamiScriptAttributes', () => {
  it('returns no script when the site URL is empty or invalid', () => {
    expect(umamiScriptAttributes({ websiteId: 'site-1', scriptPath: '/bd.js', siteUrl: '' })).toBeNull()
    expect(umamiScriptAttributes({ websiteId: 'site-1', scriptPath: '/bd.js', siteUrl: 'not a url' })).toBeNull()
  })

  it('builds the tracker tag limited to the site host', () => {
    expect(umamiScriptAttributes({ websiteId: 'site-1', scriptPath: '/bd.js', siteUrl: 'https://bogdev.com.co/' })).toEqual({
      'src': '/bd.js',
      'defer': true,
      'data-website-id': 'site-1',
      'data-domains': 'bogdev.com.co',
    })
  })

  it('skips the tracker without a website id', () => {
    expect(umamiScriptAttributes({ websiteId: '', scriptPath: '/bd.js', siteUrl: ORIGIN })).toBeNull()
  })
})

describe('isUmamiProxyPath', () => {
  it('matches the script and collect paths, ignoring the query string', () => {
    expect(isUmamiProxyPath('/bd.js', '/bd.js', '/api/bd')).toBe(true)
    expect(isUmamiProxyPath('/api/bd?x=1', '/bd.js', '/api/bd')).toBe(true)
  })

  it('leaves every other path alone', () => {
    expect(isUmamiProxyPath('/api/posts', '/bd.js', '/api/bd')).toBe(false)
    expect(isUmamiProxyPath('/api/bd/other', '/bd.js', '/api/bd')).toBe(false)
    expect(isUmamiProxyPath('/es/bd.js', '/bd.js', '/api/bd')).toBe(false)
  })
})

describe('outboundLinkUrl', () => {
  it('returns links to other origins', () => {
    expect(outboundLinkUrl('https://github.com/ale9420', ORIGIN)).toBe('https://github.com/ale9420')
    expect(outboundLinkUrl('https://api.bogdev.com.co/fediverse/user/devbog', ORIGIN)).toBe('https://api.bogdev.com.co/fediverse/user/devbog')
  })

  it('ignores site links, anchors and non-web schemes', () => {
    expect(outboundLinkUrl('/es/blog', ORIGIN)).toBeNull()
    expect(outboundLinkUrl('https://bogdev.com.co/about', ORIGIN)).toBeNull()
    expect(outboundLinkUrl('#toc', ORIGIN)).toBeNull()
    expect(outboundLinkUrl('mailto:hola@bogdev.com.co', ORIGIN)).toBeNull()
    expect(outboundLinkUrl('javascript:void(0)', ORIGIN)).toBeNull()
  })
})
