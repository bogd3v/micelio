import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { startMockStrapi } from './mock-strapi'

// A build with its own theme: one light mode, no slots, no layout (#237, acceptance criteria).
// MICELIO_THEME_DIRS points at the fixtures; the build and the server both read NUXT_PUBLIC_THEME.
const mock = await startMockStrapi()
process.env.NUXT_PUBLIC_STRAPI_URL = mock.url
process.env.NUXT_PUBLIC_SITE_URL = 'https://minimal.test'
process.env.NUXT_SITE_CACHE_SECONDS = '0'
process.env.MICELIO_THEME_DIRS = 'test/fixtures/themes'
process.env.NUXT_PUBLIC_THEME = 'minimal'

await setup({
  server: true,
  setupTimeout: 600_000,
  nuxtConfig: {
    nitro: { prerender: { crawlLinks: false } },
  },
})

describe('a build with the minimal fixture theme', () => {
  it('writes the theme\'s only mode and its scheme on <html>', async () => {
    const html = await (await fetch('/')).text()
    expect(html).toMatch(/<html[^>]* data-theme="day" data-scheme="light"/)
  })

  it('renders without the mode switch', async () => {
    for (const path of ['/', '/blog', '/privacy']) {
      const html = await (await fetch(path)).text()
      expect(html, path).not.toContain('data-mode=')
      expect(html, path).toContain('bd-header')
    }
  })

  it('uses the core defaults for every slot', async () => {
    const html = await (await fetch('/')).text()
    expect(html).not.toContain('bogota-')
    // ThemeMark default
    expect(html).toMatch(/<a [^>]*class="[^"]*bd-brand"[^>]*><span aria-hidden="true">[^<]+<\/span><\/a>/)
  })

  it('shows no place line or progress marker, which a theme provides through its messages', async () => {
    const html = await (await fetch('/')).text()
    for (const hook of ['bd-hud"', 'bd-hero-place', 'bd-progress-track', 'bd-progress-marker']) expect(html).not.toContain(hook)
    expect(html).not.toContain('Bogot')
  })

  it('uses the core\'s neutral texts where Bogota brings its own', async () => {
    const html = await (await fetch('/')).text()
    expect(html).toContain('Browse by topic')
    for (const flavour of ['savanna', 'Field guide', 'Pinchaflor']) expect(html).not.toContain(flavour)
  })

  it('serves the theme\'s roles and the core\'s optional-role defaults', async () => {
    const html = await (await fetch('/')).text()
    const href = html.match(/href="([^"]+\.css)"/)?.[1]
    expect(href).toBeTruthy()
    const css = await (await fetch(href!)).text()
    expect(css).toContain('color-scheme:light')
    expect(css).not.toContain('Archivo')
    expect(css).toContain('--glow-link:none')
  })

  it('keeps the first variant of every region', async () => {
    const html = await (await fetch('/')).text()
    for (const variant of ['bar', 'showcase', 'columns']) expect(html).toContain(`data-layout="${variant}"`)
  })
})
