import { test, expect } from '@playwright/test'

// Run by playwright.modules-off.config.ts: the mock's site-setting turns every module off

const PAGES = ['/', '/es', '/blog', '/es/blog', '/blog/linux-server-hardening-guide', '/about', '/privacy', '/es/privacy']

test('hides every module in the header, menu, tab bar and footer', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const header = page.locator('header').first()
  await expect(header.getByRole('button', { name: /Search/ })).toHaveCount(0)
  await expect(header.getByRole('link', { name: /Sign in/ })).toHaveCount(0)
  await expect(page.locator('a[href$="#fediverso"]')).toHaveCount(0)
  await expect(page.locator('#newsletter, #fediverso')).toHaveCount(0)
  await expect(page.locator('a[href*="buymeacoffee.com"]')).toHaveCount(0)
  await expect(page.locator('a[href*="/account"], a[href*="/drafts"]')).toHaveCount(0)
  await expect(page.locator('a[href="#search"]')).toHaveCount(0)

  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: /Search/ })).toHaveCount(0)
})

test('shows three tabs on mobile, without search', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle' })
  const tabs = page.getByRole('navigation', { name: 'Bottom navigation' })
  await expect(tabs.locator('.bd-tab')).toHaveCount(3)
  await expect(tabs.getByRole('button', { name: 'Search' })).toHaveCount(0)
})

test('reads an article without comments, support or fediverse', async ({ page }) => {
  await page.goto('/blog/linux-server-hardening-guide', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#comments, .bd-coffee, .bd-fedi-bar, .bd-related-news')).toHaveCount(0)
})

test('leaves the fediverse sort out of the blog', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await expect(page.locator('#bd-blog-sort option')).toHaveText(['Newest', 'Oldest'])
})

test('describes no cookies and no personal data on the privacy page', async ({ page }) => {
  await page.goto('/privacy', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'No cookies' })).toBeVisible()
  await expect(page.locator('.bd-privacy-table')).toHaveCount(0)
  await expect(page.locator('#data')).toContainText('this site has no accounts, newsletter or comments')
})

test('answers 404 on every module page and route', async ({ request }) => {
  for (const path of ['/account/sign-in', '/es/account', '/drafts', '/newsletter/unsubscribe', '/confirm', '/api/search?q=vue', '/api/auth/me', '/api/comments?relation=api::article.article:doc-vue']) {
    expect((await request.get(path, { failOnStatusCode: false })).status(), path).toBe(404)
  }
})

test('has no broken internal links', async ({ page, request }) => {
  const links = new Set<string>()
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' })
    const hrefs = await page.locator('a[href^="/"]').evaluateAll(anchors => anchors.map(a => a.getAttribute('href')!))
    for (const href of hrefs) links.add(href.split('#')[0]!)
  }
  for (const href of links) {
    const response = await request.get(href || '/', { failOnStatusCode: false })
    expect(response.status(), href).toBeLessThan(400)
  }
})
