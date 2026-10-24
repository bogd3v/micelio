import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Run by playwright.runtime-theme.config.ts: the build made for Bogotá serves the fixture theme test/fixtures/themes/alternates,
// chosen at boot, which is data only and uses the second variant of every region (#402). In dev the fixture would be the build's theme.
test.skip(!process.env.E2E_BUILD, 'Needs the build made for Bogotá: MICELIO_THEME_DIRS=test/fixtures/themes/alternates MICELIO_SPECIMEN=1 npm run build, then E2E_BUILD=1')

/** Opens a page and collects what would show a server render the client disagrees with. */
async function open(page: Page, path: string): Promise<string[]> {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Hydration')) problems.push(message.text())
  })
  page.on('pageerror', error => problems.push(error.message))
  await page.goto(path, { waitUntil: 'networkidle' })
  return problems
}

test('is the image built for Bogotá', async ({ request }) => {
  expect((await request.get('/theme/images/copeton.png')).status()).toBe(200)
})

test('renders the home page with the fixture\'s header, home and footer variants, its roles and no Bogotá slot', async ({ page }) => {
  const problems = await open(page, '/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
  await expect(page.locator('header.myc-header')).toHaveAttribute('data-layout', 'centered')
  await expect(page.locator('.myc-home')).toHaveAttribute('data-layout', 'index')
  await expect(page.locator('footer.myc-foot')).toHaveAttribute('data-layout', 'minimal')
  await expect(page.locator('[data-layout="bar"], [data-layout="showcase"], [data-layout="columns"]')).toHaveCount(0)
  await expect(page.locator('[class*="bogota-"]')).toHaveCount(0)
  // The variant's CSS comes with the fixture's stylesheet: the centered header is 152px from 768px up, the bar 64px
  const roles = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return { header: style.getPropertyValue('--myc-header-h').trim(), surface: style.getPropertyValue('--surface').trim() }
  })
  expect(roles).toEqual({ header: '152px', surface: '#f3e9df' })
  expect(problems).toEqual([])
})

test('renders the blog as a list', async ({ page }) => {
  const problems = await open(page, '/blog')
  await expect(page.locator('[data-layout="list"]')).toHaveCount(1)
  await expect(page.locator('[data-layout="grid"]')).toHaveCount(0)
  expect(problems).toEqual([])
})

test('renders an article centered, and keeps it after a client-side navigation', async ({ page }) => {
  const problems = await open(page, '/blog')
  await page.locator('[data-layout="list"] a[href="/blog/understanding-vue-composables"]').first().click()
  await expect(page).toHaveURL(/\/blog\/understanding-vue-composables$/)
  await expect(page.locator('.myc-article-page')).toHaveAttribute('data-layout', 'centered')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('.myc-article-page')).toHaveAttribute('data-layout', 'centered')
  expect(problems).toEqual([])
})

test('shows the build theme\'s variants as the alternates on the specimen, and keeps the fixture\'s header height', async ({ page }) => {
  const problems = await open(page, '/_theme')
  await expect(page.locator('html')).toHaveAttribute('data-layout-header', 'centered')
  const frames = page.locator('.myc-specimen-frame')
  // Bogotá's variants are the alternates, one copy each
  for (const variant of ['bar', 'showcase', 'grid', 'aside', 'columns']) await expect(frames.locator(`[data-layout="${variant}"]`), variant).toHaveCount(1)
  // The fixture's header and footer are the page's own, never a copy; its home and article appear once, in the active region's frame
  await expect(frames.locator('header[data-layout="centered"], footer[data-layout="minimal"]')).toHaveCount(0)
  await expect(frames.locator('[data-layout="index"]')).toHaveCount(1)
  await expect(frames.locator('.myc-article-page[data-layout="centered"]')).toHaveCount(1)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--myc-header-h').trim())).toBe('152px')
  expect(problems).toEqual([])
})
