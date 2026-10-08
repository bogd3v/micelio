import { test, expect } from '@playwright/test'

const PAGE_SECTIONS = ['hero', 'feature-grid', 'media-showcase', 'stats', 'logo-cloud', 'testimonials', 'pricing', 'faq', 'cta', 'post-list', 'newsletter', 'rich-text', 'gallery', 'scene']
const GROUPS = ['foundations', 'controls', 'labels', 'cards', 'prose', 'forms', 'states', 'regions', ...PAGE_SECTIONS.map(kind => `page-${kind}`)]

test('renders every group of the specimen', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1, name: 'Theme specimen' })).toBeVisible()
  for (const id of GROUPS) await expect(page.locator(`[data-section="${id}"]`)).toHaveCount(1)
  // Drawn when near the viewport: scroll each block in
  const blocks = page.locator('[data-section="prose"] micelio-mermaid')
  for (let index = 0; index < await blocks.count(); index++) await blocks.nth(index).scrollIntoViewIfNeeded()
  await expect(page.locator('[data-section="prose"] .bd-mermaid-diagram svg')).toHaveCount(2)
})

test('renders every page section through the real components', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  for (const kind of PAGE_SECTIONS) {
    await expect(page.locator(`.bd-specimen-group[data-section="page-${kind}"] section.bd-section[data-section="${kind}"]`).first()).toBeVisible()
  }
  // 29 variants + rich-text, each once (the newsletter is on in the e2e site)
  await expect(page.locator('.bd-specimen-group[data-section^="page-"] section.bd-section')).toHaveCount(30)
})

test('is not indexable', async ({ page, request }) => {
  const response = await request.get('/_theme')
  expect(response.status()).toBe(200)
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')
  await page.goto('/_theme')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
})

test('follows the color mode toggle', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  await page.locator('[data-section="controls"]').getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Night' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
})
