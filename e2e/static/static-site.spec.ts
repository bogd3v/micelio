import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// ADR 0006: a static site loads no Nuxt client and never asks Strapi anything at runtime
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'home (es)', path: '/es' },
  { name: 'blog list', path: '/blog' },
  { name: 'article', path: '/blog/understanding-vue-composables' },
  { name: 'article (es)', path: '/es/blog/guia-vue-composables' },
  { name: 'section page', path: '/showcase' },
  { name: 'about', path: '/about' },
]

async function requestsOf(page: Page, path: string): Promise<string[]> {
  const urls: string[] = []
  page.on('request', request => urls.push(request.url()))
  const response = await page.goto(path, { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
  // Lazy images load when they near the viewport: go through the whole page
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  })
  await page.waitForLoadState('networkidle')
  return urls
}

for (const { name, path } of PAGES) {
  test(`${name} loads no Nuxt client, payload or API call`, async ({ page, baseURL }) => {
    const urls = await requestsOf(page, path)
    expect(urls.filter(url => /\/_nuxt\/[^?]*\.m?js/.test(url))).toEqual([])
    expect(urls.filter(url => url.includes('_payload'))).toEqual([])
    expect(urls.filter(url => new URL(url).pathname.startsWith('/api/'))).toEqual([])
    expect(urls.filter(url => !url.startsWith(baseURL!) && !url.startsWith('data:'))).toEqual([])
  })

  test(`${name} has no Nuxt state or client script in the HTML`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    // The only script file is the search island (e2e/static/search.spec.ts)
    expect([...html.matchAll(/<script[^>]*\ssrc="([^"]*)"/g)].map(match => match[1]).filter(src => !/^\/_islands\/search-[\w-]+\.js$/.test(src!))).toEqual([])
    expect(html).not.toContain('__NUXT__')
    expect(html).not.toContain('__NUXT_DATA__')
    expect(html).not.toContain('_payload.json')
    expect(html).not.toMatch(/rel="modulepreload"/)
  })
}

test('the pages render their content without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/blog/understanding-vue-composables')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Understanding Vue Composables')
  await page.goto('/blog')
  await expect(page.locator('.bd-blog-grid .bd-card-title').first()).toBeVisible()
  await context.close()
})

test('module pages are not generated', async ({ request }) => {
  for (const path of ['/account', '/account/sign-in', '/es/account', '/drafts', '/es/drafts', '/newsletter/unsubscribe', '/es/confirm', '/es/newsletter/unsubscribe', '/confirm', '/_theme']) {
    expect((await request.get(path)).status(), path).toBe(404)
  }
})

test('the API is not part of the site', async ({ request }) => {
  for (const path of ['/api/posts', '/api/search?q=vue', '/api/comments', '/api/auth/me']) {
    expect((await request.get(path)).status(), path).toBe(404)
  }
})

test('feeds, sitemap and robots.txt are files', async ({ request }) => {
  for (const path of ['/feed.xml', '/es/feed.xml', '/feed/linux.xml', '/es/feed/linux.xml']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')
    expect(await response.text()).toContain('<rss')
  }
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('/blog/understanding-vue-composables')
  expect(sitemap).toContain('/es/blog/guia-vue-composables')
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toContain('User-Agent')
})

test('an unknown path answers the 404 page', async ({ request }) => {
  const response = await request.get('/blog/does-not-exist')
  expect(response.status()).toBe(404)
  expect(await response.text()).toContain('<html')
})

// Without JS every control is a link or absent, and the language links point at the real translation
const LANGUAGE_LINKS = [
  { path: '/blog/understanding-vue-composables', es: '/es/blog/guia-vue-composables' },
  { path: '/es/blog/guia-vue-composables', en: '/blog/understanding-vue-composables' },
  { path: '/showcase', es: '/es/muestra' },
]

for (const { path, ...expected } of LANGUAGE_LINKS) {
  test(`${path} links to its translation and has no visible button`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    expect((await page.goto(path))?.status()).toBe(200)
    for (const [code, href] of Object.entries(expected)) {
      for (const link of await page.locator(`a[data-bd-lang="${code}"]`).all()) {
        expect(await link.getAttribute('href')).toBe(href)
      }
    }
    await expect(page.locator('button:visible:not([type="submit"])')).toHaveCount(0)
    await expect(page.locator('#bd-site-nav')).toHaveCount(1)
    await context.close()
  })
}
