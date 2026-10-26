import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { draftPage } from '../../e2e/fixtures/drafts.mjs'
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

  it('answers the weight route with 404 and never calls the CMS, whatever the grant', async () => {
    const cookie = '__Host-micelio_preview=preview-grant-1-yyyyyyyyyyyyyyyyyyyyyyyy'
    for (const path of ['/api/preview/api%3A%3Apage.page/doc-page-draft/weight', '/api/preview/api%3A%3Aarticle.article/doc-linux/weight?mode=static']) {
      const response = await fetch(path, { headers: { cookie } })
      expect(response.status, path).toBe(404)
    }
    expect(mock.preview.calls).toEqual([])
  })

  // A system grant frames nothing, so the budget is measured at publish whatever the operator chose for the admin (ADR 0019, amendment of 2026-10-25)
  it('still measures a draft for a system grant, frames nothing, and keeps the draft routes closed to it', async () => {
    const grant = mock.preview.issueSystem({ kind: 'page', documentId: 'doc-page-draft', locale: 'en', version: draftPage.updatedAt })
    mock.preview.calls.length = 0
    const weight = await fetch('/api/preview/api%3A%3Apage.page/doc-page-draft/weight?locale=en&mode=static', { headers: { 'x-micelio-preview-grant': grant } })
    expect(weight.status).toBe(200)
    expect(weight.headers.getSetCookie()).toEqual([])
    expect(weight.headers.get('content-security-policy') ?? '').toContain('frame-ancestors \'none\'')
    expect(((await weight.json()) as { data: { blocks: unknown[] } }).data.blocks.length).toBeGreaterThan(5)
    // The CMS was asked once: the renders read the copy the route kept
    expect(mock.preview.calls).toHaveLength(1)
    const again = mock.preview.issueSystem({ kind: 'page', documentId: 'doc-page-draft', locale: 'en', version: draftPage.updatedAt })
    for (const path of ['/api/drafts/pages/doc-page-draft?locale=en', '/drafts/pages/doc-page-draft?locale=en']) {
      const response = await fetch(path, { headers: { 'x-micelio-preview-grant': again, 'cookie': `__Host-micelio_preview=${again}` } })
      expect(response.status, path).toBe(404)
      expect(response.headers.get('x-frame-options'), path).toBe('DENY')
    }
  })
})
