import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { startMockStrapi } from './mock-strapi'

// The route the host check of the CMS plugin asks (`frontend-release-line`): the version of this package and nothing from the CMS
const mock = await startMockStrapi()
process.env.NUXT_PUBLIC_STRAPI_URL = mock.url
process.env.NUXT_PUBLIC_SITE_URL = 'https://health.test'
process.env.NUXT_STRAPI_API_TOKEN = 'test-api-token'
process.env.NUXT_SITE_CACHE_SECONDS = '0'

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }

await setup({
  server: true,
  setupTimeout: 600_000,
  nuxtConfig: {
    nitro: { prerender: { crawlLinks: false } },
  },
})

describe('/_health', () => {
  it('GET /_health answers 200, application/json, no-store and the version of package.json', async () => {
    const response = await fetch('/_health', { headers: { accept: 'application/json' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ version })
  })

  it('GET /_health answers 200 and never asks the CMS for redirects, even for a row that lists it', async () => {
    mock.redirects.state.rows = [{ from: '/_health', to: '/privacy', locale: null }]
    const before = mock.redirects.calls.length
    const response = await fetch('/_health', { redirect: 'manual' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ version })
    expect(mock.redirects.calls.length).toBe(before)
    mock.redirects.state.rows = []
  })

  it('GET /_health answers 200 while the CMS is unreachable', async () => {
    mock.server.closeAllConnections()
    await new Promise<void>(resolve => mock.server.close(() => resolve()))
    const response = await fetch('/_health', { headers: { accept: 'application/json' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ version })
  })

  it('HEAD /_health answers 200 with no body', async () => {
    const response = await fetch('/_health', { method: 'HEAD' })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
  })

  it('POST /_health answers 405 with an Allow header', async () => {
    const response = await fetch('/_health', { method: 'POST' })
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
  })
})
