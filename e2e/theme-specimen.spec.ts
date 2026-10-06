import { test, expect } from '@playwright/test'

const GROUPS = ['foundations', 'controls', 'labels', 'cards', 'prose', 'forms', 'states', 'regions', 'page-sections']

test('renders every group of the specimen', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1, name: 'Theme specimen' })).toBeVisible()
  for (const id of GROUPS) await expect(page.locator(`[data-section="${id}"]`)).toHaveCount(1)
  await expect(page.locator('[data-section="prose"] .bd-mermaid-diagram svg')).toHaveCount(2)
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
