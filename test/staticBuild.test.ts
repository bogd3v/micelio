import { describe, expect, it, vi } from 'vitest'
import { Locale } from '../app/interfaces/locale'
import { articleRoute, failsBuild, headersFile, injectCspMeta, mediaFileName, mediaUrlsIn, missingRoutes, noScriptsViolations, rewriteMediaUrls, scriptHashDisagreements, sectionPageRoute, staticFileRoutes, stripImageErrorHandlers } from '../app/helpers/staticBuild'
import { SECURITY_HEADERS, contentSecurityPolicy } from '../app/helpers/securityHeaders'
import { strapiRequest, strapiRequestUrl } from '../server/lib/strapiRequest'

const PAGE = '<html><head><script>(function(){var d=document})()</script><script type="application/ld+json">{"a":1}</script></head><body>Nuxt __NUXT__ in an article</body></html>'

describe('noScriptsViolations', () => {
  it('accepts a page with inline scripts and the word Nuxt in its text', () => {
    expect(noScriptsViolations(PAGE)).toEqual([])
  })

  it('finds Nuxt scripts, preloads, state and payload', () => {
    expect(noScriptsViolations('<script type="module" src="/_nuxt/BrQ4.js" crossorigin></script>')).toEqual(['a script from /_nuxt/'])
    expect(noScriptsViolations('<link rel="modulepreload" as="script" crossorigin href="/_nuxt/entry.mjs">')).toEqual(['a preload of /_nuxt/*.js'])
    expect(noScriptsViolations('<script>window.__NUXT__={}</script>')).toEqual(['the Nuxt state (__NUXT__)'])
    expect(noScriptsViolations('<script type="application/json" id="__NUXT_DATA__">[]</script>')).toEqual(['the Nuxt state (__NUXT__)'])
    expect(noScriptsViolations('<link rel="preload" as="fetch" href="/blog/_payload.json">')).toEqual(['a preload of _payload.json'])
  })

  it('lets stylesheets and fonts from /_nuxt/ through', () => {
    expect(noScriptsViolations('<link rel="stylesheet" href="/_nuxt/entry.css"><link rel="preload" href="/_nuxt/font.woff2">')).toEqual([])
  })
})

describe('static routes', () => {
  it('prefixes the routes of the non-default locale', () => {
    expect(articleRoute('hello', Locale.English)).toBe('/blog/hello')
    expect(articleRoute('hola', Locale.SpanishColombia)).toBe('/es/blog/hola')
    expect(sectionPageRoute('muestra', Locale.SpanishColombia)).toBe('/es/muestra')
  })

  it('lists the feeds of both locales, the sitemap and robots.txt', () => {
    const routes = staticFileRoutes()
    expect(routes).toEqual(expect.arrayContaining(['/feed.xml', '/es/feed.xml', '/feed/linux.xml', '/es/feed/linux.xml', '/sitemap.xml', '/robots.txt']))
  })
})

describe('strapiRequest', () => {
  it('joins the path to the Strapi URL without a double slash', () => {
    expect(strapiRequestUrl({ strapiUrl: 'https://cms.example.org//' }, '/api/articles')).toBe('https://cms.example.org/api/articles')
  })

  it('sends the token and the query, and fails on an error status', async () => {
    const seen: Array<{ url: string, authorization: string | null }> = []
    const server = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input as RequestInfo, init)
      seen.push({ url: request.url, authorization: request.headers.get('authorization') })
      return new Response(request.url.includes('fail') ? '{}' : '{"data":[]}', { status: request.url.includes('fail') ? 500 : 200, headers: { 'content-type': 'application/json' } })
    })
    try {
      const config = { strapiUrl: 'https://cms.example.org', strapiApiToken: 'secret' }
      await expect(strapiRequest(config, '/api/articles', { query: { locale: 'en' } })).resolves.toEqual({ data: [] })
      expect(seen[0]).toEqual({ url: 'https://cms.example.org/api/articles?locale=en', authorization: 'Bearer secret' })
      await expect(strapiRequest({ strapiUrl: config.strapiUrl }, '/api/fail')).rejects.toThrow()
      expect(seen[1]?.authorization).toBeNull()
    } finally {
      server.mockRestore()
    }
  })
})

describe('build failures', () => {
  const required = new Set(['/', '/blog/hello'])

  it('ignores only a 404 found by the crawler', () => {
    expect(failsBuild('/blog/dead-link', 404, required)).toBe(false)
    expect(failsBuild('/blog/dead-link', 500, required)).toBe(true)
    expect(failsBuild('/about', undefined, required)).toBe(true)
  })

  it('fails on any error of a required route, a 404 included', () => {
    expect(failsBuild('/', 404, required)).toBe(true)
    expect(failsBuild('/blog/hello', 404, required)).toBe(true)
  })

  it('finds required routes that were never prerendered', () => {
    expect(missingRoutes(required, ['/', '/about'])).toEqual(['/blog/hello'])
    expect(missingRoutes(required, ['/blog/hello', '/'])).toEqual([])
  })
})

describe('media on the CMS origin', () => {
  const origin = 'https://cms.example.org'
  const html = `<img src="${origin}/uploads/logo.svg" alt="x"><video poster="${origin}/uploads/p.png?a=1&amp;b=2"><source src="${origin}/uploads/v.mp4"></video><img src="/_ipx/w_1/a.jpg"><img src="https://other.org/x.svg"><a href="${origin}/uploads/doc.pdf">d</a>`

  it('finds the src and poster URLs of the origin only', () => {
    expect(mediaUrlsIn(html, [origin])).toEqual([`${origin}/uploads/logo.svg`, `${origin}/uploads/p.png?a=1&b=2`, `${origin}/uploads/v.mp4`])
  })

  it('rewrites them to site paths and leaves the rest', () => {
    const local = new Map([[`${origin}/uploads/logo.svg`, '/_media/ab-logo.svg'], [`${origin}/uploads/p.png?a=1&b=2`, '/_media/cd-p.png']])
    const out = rewriteMediaUrls(html, local)
    expect(out).toContain('<img src="/_media/ab-logo.svg" alt="x">')
    expect(out).toContain('poster="/_media/cd-p.png"')
    expect(out).toContain(`src="${origin}/uploads/v.mp4"`)
    expect(out).toContain('src="https://other.org/x.svg"')
  })

  it('names the file after a hash and a safe base name', () => {
    expect(mediaFileName(`${origin}/uploads/my logo (1).svg?x=1`, 'abcd1234')).toBe('abcd1234-my_20logo_20_1_.svg')
  })
})

describe('static headers', () => {
  const policy = contentSecurityPolicy({ scriptHashes: ['abc='], imageOrigins: [] })

  it('removes the inline onerror of NuxtImg and nothing else', () => {
    const img = '<img src="/a.png" data-nuxt-img onerror="this.setAttribute(&#39;data-error&#39;, 1)" alt="x">'
    expect(stripImageErrorHandlers(img)).toBe('<img src="/a.png" data-nuxt-img alt="x">')
    expect(stripImageErrorHandlers('<img onerror="alert(1)">')).toBe('<img onerror="alert(1)">')
  })

  it('injects the policy as a meta after the charset, escaped', () => {
    const out = injectCspMeta('<html><head><meta charset="utf-8"><title>x</title></head></html>', 'a "b" & c')
    expect(out).toBe('<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="a &quot;b&quot; &amp; c"><title>x</title></head></html>')
    expect(injectCspMeta('<html><head><title>x</title>', 'p')).toContain('<head><meta http-equiv')
    expect(injectCspMeta('no head', 'p')).toBe('no head')
  })

  it('drops frame-ancestors from the meta policy only', () => {
    expect(policy).toContain('frame-ancestors \'none\'')
    expect(contentSecurityPolicy({ scriptHashes: ['abc='], imageOrigins: [], meta: true })).not.toContain('frame-ancestors')
    expect(policy).toContain('img-src \'self\' data: blob:;')
  })

  it('names the pages whose scripts differ from the common ones', () => {
    expect(scriptHashDisagreements(new Map([['/', ['a']], ['/b', ['a']], ['/c', ['a', 'b']], ['/d', []]]))).toEqual(['/c', '/d'])
    expect(scriptHashDisagreements(new Map([['/', ['a', 'b']], ['/x', ['b', 'a', 'a']]]))).toEqual([])
    expect(scriptHashDisagreements(new Map())).toEqual([])
  })

  it('writes one /* rule with the policy and the security headers, and immutable assets', () => {
    const file = headersFile(policy)
    const [everything = '', ...assets] = file.trim().split('\n\n')
    expect(everything.split('\n')[0]).toBe('/*')
    expect(everything).toContain(`  Content-Security-Policy: ${policy}`)
    expect(everything).toContain('  Strict-Transport-Security: max-age=31536000')
    expect(everything).toContain('  Cross-Origin-Opener-Policy: same-origin')
    expect(everything.split('\n')).toHaveLength(2 + Object.keys(SECURITY_HEADERS).length)
    expect(assets).toEqual(['/_nuxt/*', '/_ipx/*', '/_media/*'].map(path => `${path}\n  Cache-Control: public, max-age=31536000, immutable`))
  })
})
