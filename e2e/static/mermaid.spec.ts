import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// ADR 0006, section 6: Mermaid is a heavy island. The page declares it, a small loader imports it near the block, and a
// static site has no Nuxt client to do any of it.
const ARTICLE = '/blog/linux-server-hardening-guide'
const PLAIN_ARTICLE = '/blog/understanding-vue-composables'
const LOADER = /^\/_islands\/loader-[\w-]+\.js$/
const SEARCH = /^\/_islands\/search-[\w-]+\.js$/

function trackRequests(page: Page): string[] {
  const paths: string[] = []
  page.on('request', request => paths.push(new URL(request.url()).pathname))
  return paths
}

async function drawDiagrams(page: Page): Promise<void> {
  const blocks = page.locator('micelio-mermaid')
  for (let index = 0; index < await blocks.count(); index++) await blocks.nth(index).scrollIntoViewIfNeeded()
  await expect(page.locator('.bd-mermaid-diagram svg')).toHaveCount(2)
}

test('the page declares the island and loads only the loader', async ({ request }) => {
  const html = await (await request.get(ARTICLE)).text()
  const sources = [...html.matchAll(/<script[^>]*\ssrc="([^"]*)"/g)].map(match => match[1]!)
  expect(sources).toHaveLength(2)
  expect(sources.filter(src => SEARCH.test(src))).toHaveLength(1)
  expect(sources.filter(src => LOADER.test(src))).toHaveLength(1)
  expect(html).toMatch(/<script[^>]*id="micelio-island-mermaid"[^>]*type="application\/json"|<script[^>]*type="application\/json"[^>]*id="micelio-island-mermaid"/)
  expect(html).not.toMatch(/rel="modulepreload"/)
  expect(html.match(/<micelio-mermaid\b/g)).toHaveLength(3)
})

test('a page without a diagram has no loader and no declaration', async ({ request }) => {
  const html = await (await request.get(PLAIN_ARTICLE)).text()
  expect([...html.matchAll(/<script[^>]*\ssrc="([^"]*)"/g)].map(match => match[1]!).filter(src => !SEARCH.test(src))).toEqual([])
  expect(html).not.toContain('micelio-island-')
})

test('nothing of Mermaid loads until a block is near, and then the diagrams are drawn', async ({ page }) => {
  const paths = trackRequests(page)
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  await expect(page.locator('micelio-mermaid').first()).not.toBeInViewport()
  expect(paths.filter(path => path.startsWith('/_islands/') && !SEARCH.test(path) && !LOADER.test(path))).toEqual([])

  await drawDiagrams(page)
  expect(paths.filter(path => /^\/_islands\/mermaid-[\w-]+\.js$/.test(path))).toHaveLength(1)
  expect(paths.filter(path => path.startsWith('/_islands/chunks/')).length).toBeGreaterThan(0)
  expect(paths.filter(path => /^\/_nuxt\/.*\.m?js$/.test(path))).toEqual([])
  await expect(page.getByRole('img', { name: 'SSH login flow' }).locator('svg')).toBeVisible()
  await expect(page.locator('.bd-mermaid-diagram').nth(1)).toHaveAttribute('aria-label', 'Diagram')
})

test('a diagram that cannot be parsed keeps its source', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  await drawDiagrams(page)
  const broken = page.locator('micelio-mermaid:not(.bd-mermaid-ready)')
  await expect(broken).toHaveCount(1)
  await expect(broken.locator('code')).toBeVisible()
})

test('the diagrams are drawn again when the mode changes', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  await drawDiagrams(page)
  const node = page.getByRole('img', { name: 'SSH login flow' }).locator('.node rect').first()
  const dayFill = await node.evaluate(element => getComputedStyle(element).fill)
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'noche')
    document.documentElement.setAttribute('data-scheme', 'dark')
  })
  await expect.poll(async () => page.getByRole('img', { name: 'SSH login flow' }).locator('.node rect').first().evaluate(element => getComputedStyle(element).fill)).not.toBe(dayFill)
})

test('without JavaScript the reader gets the source of every diagram', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const page = await context.newPage()
  await page.goto(ARTICLE)
  await expect(page.locator('micelio-mermaid code')).toHaveCount(3)
  await expect(page.locator('micelio-mermaid').first().locator('code')).toBeVisible()
  await expect(page.locator('micelio-mermaid').first()).toContainText('SSH login flow')
  await context.close()
})
