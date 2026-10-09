import { test, expect } from '@playwright/test'

test('marks an article as read after reading it and keeps it in the browser', async ({ page }) => {
  const hydration: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Hydration')) hydration.push(message.text())
  })

  await page.goto('/blog', { waitUntil: 'networkidle' })
  const card = page.locator('.bd-card', { has: page.getByRole('link', { name: 'Understanding Vue Composables' }) })
  await expect(card.locator('.bd-read-mark')).toHaveCount(0)

  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  await page.locator('.bd-prose').evaluate(element => element.scrollIntoView({ block: 'end' }))
  await expect.poll(() => page.evaluate(() => localStorage.getItem('micelio-read-articles'))).toBe('["doc-vue"]')

  await page.goto('/blog', { waitUntil: 'networkidle' })
  await expect(card.locator('.bd-read-mark')).toHaveText('✓ Read')
  await expect(page.locator('.bd-card .bd-read-mark')).toHaveCount(1)

  await page.reload({ waitUntil: 'networkidle' })
  await expect(card.locator('.bd-read-mark')).toHaveText('✓ Read')
  await expect(page.locator('.bd-blog-read-note')).toHaveText('01 article read · kept in your browser')

  await page.goto('/blog?view=log', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-log-row', { hasText: 'Understanding Vue Composables' }).locator('.bd-read-mark')).toHaveText('✓ Read')
  expect(hydration).toEqual([])
})

test('clears the reading history from the blog', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('micelio-read-articles', '["doc-vue","doc-linux"]'))
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-card .bd-read-mark')).toHaveCount(2)
  await page.getByRole('button', { name: 'Clear reading history' }).click()
  await expect(page.locator('.bd-card .bd-read-mark')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'History cleared' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('micelio-read-articles'))).toBeNull()
})

test('keeps the history out of every request', async ({ page }) => {
  const leaks: string[] = []
  page.on('request', (request) => {
    const payload = `${request.url()} ${request.postData() ?? ''} ${request.headers().cookie ?? ''}`
    if (payload.includes('micelio-read-articles') || payload.includes('doc-linux')) leaks.push(request.url())
  })
  await page.addInitScript(() => localStorage.setItem('micelio-read-articles', '["doc-linux"]'))
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  await page.locator('.bd-prose').evaluate(element => element.scrollIntoView({ block: 'end' }))
  await expect.poll(() => page.evaluate(() => localStorage.getItem('micelio-read-articles'))).toBe('["doc-linux","doc-vue"]')
  expect(leaks).toEqual([])
})
