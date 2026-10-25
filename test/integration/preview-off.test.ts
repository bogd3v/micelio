import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { startMockStrapi } from './mock-strapi'

// A server with no NUXT_PREVIEW_ADMIN_ORIGIN has no preview (ADR 0019, section 5): the default, and what an operator who never asked for it gets
const mock = await startMockStrapi()
process.env.NUXT_PUBLIC_STRAPI_URL = mock.url
process.env.NUXT_PUBLIC_SITE_URL = 'https://off.test'
process.env.NUXT_STRAPI_API_TOKEN = 'test-api-token'
process.env.NUXT_SITE_CACHE_SECONDS = '0'
delete process.env.NUXT_PREVIEW_ADMIN_ORIGIN

await setup({
  server: true,
  setupTimeout: 600_000,
  nuxtConfig: {
    nitro: { prerender: { crawlLinks: false } },
  },
})

describe('a server with the preview off', () => {
  it('answers /_preview with 404 and never calls the CMS, whatever the token', async () => {
    const token = mock.preview.issue({ documentId: 'doc-linux', locale: 'en', adminOrigin: 'https://cms.off.test' })
    for (const path of [`/_preview?token=${token}`, '/_preview']) {
      const response = await fetch(path, { redirect: 'manual' })
      expect(response.status, path).toBe(404)
      expect(response.headers.getSetCookie()).toEqual([])
      expect(response.headers.get('content-security-policy') ?? '').toContain('frame-ancestors \'none\'')
      expect(response.headers.get('x-frame-options')).toBe('DENY')
    }
    expect(mock.preview.calls).toEqual([])
  })

  it('ignores a grant cookie: the draft routes answer as they did before', async () => {
    const cookie = '__Host-micelio_preview=preview-grant-1-yyyyyyyyyyyyyyyyyyyyyyyy'
    for (const path of ['/api/drafts/doc-linux?locale=en', '/api/drafts/pages/doc-page-draft', '/drafts/doc-linux?locale=en']) {
      const response = await fetch(path, { headers: { cookie } })
      expect(response.status, path).toBe(404)
      expect(response.headers.get('x-frame-options'), path).toBe('DENY')
    }
    expect(mock.preview.calls).toEqual([])
  })
})
