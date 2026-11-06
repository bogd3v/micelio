import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { startMockStrapi } from './mock-strapi'

// The 301 redirects of the plugin's pages (bogd3v/micelio#733, docs/api.md "Redirects"): the server asks the mock of `GET /api/micelio/redirects`
const mock = await startMockStrapi()
process.env.NUXT_PUBLIC_STRAPI_URL = mock.url
process.env.NUXT_PUBLIC_SITE_URL = 'https://redirects.test'
process.env.NUXT_STRAPI_API_TOKEN = 'test-api-token'
// The list is asked again on every request, so a test sees the rows it has just set
process.env.NUXT_SITE_CACHE_SECONDS = '0'
process.env.NUXT_MICELIO_SITE = 'example'

await setup({
  server: true,
  setupTimeout: 600_000,
  nuxtConfig: {
    nitro: { prerender: { crawlLinks: false } },
  },
})

const row = (from: string, to: string, locale: string | null = 'en') => ({ from, to, locale })

type LogLine = { level: string, event: string, cause?: string, message: string }

/** The structured lines the server wrote to standard error so far (docs/security.md, "Logs"). */
function lines(): LogLine[] {
  return useTestContext().serverLogs.flatMap(chunk => chunk.split('\n'))
    .filter(text => text.startsWith('{'))
    .flatMap((text) => {
      try {
        return [JSON.parse(text) as LogLine]
      } catch {
        return []
      }
    })
}

function ask(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, { redirect: 'manual', ...init })
}

afterEach(() => {
  mock.redirects.state.failing = 0
  mock.redirects.state.rows = []
})

describe('redirects', () => {
  it('a seeded redirect answers 301 with its Location', async () => {
    mock.redirects.state.rows = [row('/old-privacy', '/privacy'), row('/vieja', '/privacidad', 'es'), row('/older-privacy', '/old-privacy')]

    const moved = await ask('/old-privacy')
    expect(moved.status).toBe(301)
    expect(moved.headers.get('location')).toBe('/privacy')
    expect(moved.headers.get('cache-control')).toBe('public, max-age=60')
    // The query goes with the visitor, a chain is one hop, a trailing slash is the same address, and a Spanish row answers under /es
    expect((await ask('/old-privacy?utm_source=feed')).headers.get('location')).toBe('/privacy?utm_source=feed')
    expect((await ask('/older-privacy')).headers.get('location')).toBe('/privacy')
    expect((await ask('/old-privacy/')).headers.get('location')).toBe('/privacy')
    expect((await ask('/es/vieja')).headers.get('location')).toBe('/es/privacidad')
    expect((await ask('/old-privacy', { method: 'HEAD' })).status).toBe(301)
    // The page that is not redirected, and the same path without the locale it was recorded for, are left alone
    expect((await ask('/privacy')).status).toBe(200)
    expect((await ask('/vieja')).status).toBe(404)
    // A write is not redirected
    expect((await ask('/old-privacy', { method: 'POST' })).status).not.toBe(301)

    // It asked for the configured site with the API token, and asks again with the tag it was given
    const calls = mock.redirects.calls.slice(-2)
    expect(calls.map(call => call.site)).toEqual(['example', 'example'])
    expect(calls[0]!.ifNoneMatch).toMatch(/^"[\w-]+"$/)
  })

  it('a cycle is dropped with a warning', async () => {
    mock.redirects.state.rows = [row('/loop-a', '/loop-b'), row('/loop-b', '/loop-a'), row('/fine-old', '/privacy')]
    const before = lines().length

    expect((await ask('/loop-a')).status).toBe(404)
    expect((await ask('/loop-b')).status).toBe(404)
    // The rest of the list is served
    expect((await ask('/fine-old')).headers.get('location')).toBe('/privacy')

    await vi.waitFor(() => {
      const warned = lines().slice(before).filter(line => line.event === 'cms.redirects.dropped')
      expect(warned.map(line => line.message).sort()).toEqual([
        'Redirect dropped: /loop-a to /loop-b: part of a redirect cycle',
        'Redirect dropped: /loop-b to /loop-a: part of a redirect cycle',
      ])
      expect(warned.every(line => line.level === 'warn')).toBe(true)
    })
  })

  it('a redirect that leaves the site is dropped with a warning', async () => {
    mock.redirects.state.rows = [row('/away', 'https://evil.example/x'), row('/protocol-relative', '//evil.example')]
    expect((await ask('/away')).status).toBe(404)
    expect((await ask('/protocol-relative')).status).toBe(404)
  })

  it('with the CMS down the page answers and the last list stays', async () => {
    mock.redirects.state.rows = [row('/old-privacy', '/privacy')]
    expect((await ask('/old-privacy')).status).toBe(301)

    const before = lines().length
    for (const failing of [500, 401, 403]) {
      mock.redirects.state.failing = failing
      const page = await ask('/privacy')
      expect(page.status).toBe(200)
      // The list in use still answers, and so does a path it does not hold
      const moved = await ask('/old-privacy')
      expect(moved.status).toBe(301)
      expect(moved.headers.get('location')).toBe('/privacy')
      expect((await ask('/nowhere')).status).toBe(404)
    }
    await vi.waitFor(() => {
      const failed = lines().slice(before).filter(line => line.event === 'cms.redirects')
      expect(failed.length).toBeGreaterThanOrEqual(3)
      expect(failed.every(line => line.level === 'error')).toBe(true)
      // A token without the grant says so, with the name of the grant
      expect(failed.some(line => line.message.includes('plugin::micelio.redirects.find'))).toBe(true)
    })

    // A site the plugin does not know is a mistake to fix, not a CMS without redirects: it is logged and the list stays
    const beforeUnknown = lines().length
    mock.redirects.state.unknownSite = true
    expect((await ask('/old-privacy')).status).toBe(301)
    await vi.waitFor(() => {
      const unknown = lines().slice(beforeUnknown).filter(line => line.event === 'cms.redirects')
      expect(unknown.some(line => line.level === 'error' && line.message.includes('NUXT_MICELIO_SITE'))).toBe(true)
    })
    mock.redirects.state.unknownSite = false

    // When the CMS is back the list is read again
    mock.redirects.state.failing = 0
    mock.redirects.state.rows = [row('/old-privacy', '/privacy'), row('/other-old', '/privacy')]
    expect((await ask('/other-old')).status).toBe(301)
  })
})
