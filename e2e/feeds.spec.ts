import { test, expect } from '@playwright/test'

async function parseFeed(page: import('@playwright/test').Page, path: string) {
  const response = await page.request.get(path)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('application/rss+xml; charset=utf-8')
  const xml = await response.text()
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'application/xml')
    return {
      error: doc.querySelector('parsererror')?.textContent ?? null,
      title: doc.querySelector('channel > title')?.textContent,
      items: Array.from(doc.querySelectorAll('item > title')).map(node => node.textContent),
    }
  }, xml)
}

test('serves well-formed feeds per category and language', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  for (const [path, title, items] of [
    ['/feed.xml', 'BogDev', ['Understanding Vue Composables', 'Linux Server Hardening Guide']],
    ['/es/feed.xml', 'BogDev (Español)', ['Guía de Vue Composables']],
    ['/feed/linux.xml', 'BogDev - Linux and open source', ['Linux Server Hardening Guide']],
    ['/es/feed/software.xml', 'BogDev - Desarrollo de software', ['Guía de Vue Composables']],
    ['/feed/privacidad.xml', 'BogDev - Privacy', []],
  ] as const) {
    const feed = await parseFeed(page, path)
    expect(feed.error, path).toBeNull()
    expect(feed.title, path).toBe(title)
    expect(feed.items, path).toEqual(items)
  }
  expect((await page.request.get('/feed/cooking.xml')).status()).toBe(404)
})

test('links the category feeds from the blog and the filtered page head', async ({ page }) => {
  await page.goto('/es/blog/category/linux', { waitUntil: 'networkidle' })
  const feeds = page.locator('.bd-blog-feeds')
  await expect(feeds.getByRole('link', { name: 'Feed RSS de Linux' })).toHaveAttribute('href', '/es/feed/linux.xml')
  await expect(page.locator('.bd-blog-aside').getByRole('link', { name: /RSS · feed completo/ })).toHaveAttribute('href', '/es/feed.xml')
  const alternate = page.locator('head link[rel="alternate"][type="application/rss+xml"][href$="/es/feed/linux.xml"]')
  await expect(alternate).toHaveCount(1)
  await expect(alternate).toHaveAttribute('title', 'BogDev RSS · Linux y código abierto')

  await page.goto('/es/blog', { waitUntil: 'networkidle' })
  await expect(page.locator('head link[rel="alternate"][href*="/feed/"]')).toHaveCount(0)
})
