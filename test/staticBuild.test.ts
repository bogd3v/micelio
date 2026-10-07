import { describe, expect, it, vi } from 'vitest'
import { Locale } from '../app/interfaces/locale'
import { articleRoute, failsBuild, missingRoutes, noScriptsViolations, sectionPageRoute, staticFileRoutes } from '../app/helpers/staticBuild'
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
