import { test, expect } from '@playwright/test'

// Run by playwright.categories.config.ts: the mock has articles in garden and kitchen (English), garden and invierno (Spanish), no slug of which the core knows.
// Privacy, DIY and AI have none; software and linux have one each (ADR 0016)

test('lists the categories of the CMS with articles in the blog filters and the sidebar', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  const chips = page.getByRole('group', { name: 'Filter by category' }).getByRole('link')
  await expect(chips).toHaveText([/All/, /Software development/, /Linux and open source/, /Garden/, /Kitchen/])
  await expect(chips.nth(3).locator('.myc-latest-dot')).toHaveAttribute('style', /var\(--category-1\)/)
  await expect(chips.nth(4).locator('.myc-latest-dot')).toHaveAttribute('style', /var\(--category-2\)/)
  // Software ranks fourth, but the CMS pins its color to 2; linux keeps its rank color
  await expect(chips.nth(1).locator('.myc-latest-dot')).toHaveAttribute('style', /var\(--category-2\)/)
  await expect(chips.nth(2).locator('.myc-latest-dot')).toHaveAttribute('style', /var\(--category-5\)/)

  const feeds = page.getByRole('complementary').getByRole('list', { name: 'One feed per category:' }).getByRole('link')
  await expect(feeds).toHaveText([/Software development/, /Linux and open source/, /Garden/, /Kitchen/])
  await expect(feeds.nth(2)).toHaveAttribute('href', '/feed/garden.xml')
  await expect(page.getByText('Artificial intelligence')).toHaveCount(0)
})

test('names the categories in Spanish and leaves out those with no Spanish article', async ({ page }) => {
  await page.goto('/es/blog', { waitUntil: 'networkidle' })
  const chips = page.getByRole('group', { name: 'Filtrar por categoría' }).getByRole('link')
  // Kitchen has no Spanish version and invierno exists only in Spanish
  await expect(chips).toHaveText([/Todos/, /Desarrollo de software/, /Jardín/, /Invierno/])
})

test('lists them in the footer and the search palette', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const footer = page.getByRole('contentinfo').getByRole('navigation', { name: 'Topics' })
  await expect(footer.getByRole('link')).toHaveText(['Software development', 'Linux and open source', 'Garden', 'Kitchen'])

  await page.keyboard.press('ControlOrMeta+k')
  const topics = page.getByRole('dialog', { name: 'Search BogDev' }).getByRole('group', { name: 'Topics' }).getByRole('option')
  await expect(topics).toHaveText([/Software development/, /Linux and open source/, /Garden/, /Kitchen/])
})

test('shows the field guide with the categories that have articles', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const guide = page.locator('section[aria-labelledby="guide-title"]')
  await expect(guide.getByRole('heading', { level: 3 })).toHaveText(['Software development', 'Linux and open source', 'Garden', 'Kitchen'])
  await expect(guide.getByRole('link').nth(2)).toHaveAttribute('href', '/blog/category/garden')
})

test('draws a bird for a category the theme knows and leaves no art box for one it does not', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const cards = page.locator('section[aria-labelledby="guide-title"] .myc-guide-card')
  const software = cards.filter({ hasText: 'Software development' }).locator('.myc-guide-art')
  const garden = cards.filter({ hasText: 'Garden' }).locator('.myc-guide-art')
  await expect(software.locator('svg')).toBeVisible()
  await expect(garden).toHaveCount(1)
  await expect(garden).toHaveCSS('display', 'none')
  await expect(garden.locator('svg')).toHaveCount(0)
})

test('filters the home latest by a category no constant knows', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Filter by topic' }).getByRole('button', { name: /Kitchen/ }).click()
  await expect(page.getByRole('heading', { name: 'Kitchen article' })).toBeVisible()
})

test('the language switch of a category that exists in one language only goes to the blog list', async ({ page }) => {
  await page.goto('/es/blog/category/invierno', { waitUntil: 'networkidle' })
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(1)
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/blog$/)

  // A category both languages have keeps its own page
  await page.goto('/es/blog/category/garden', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/blog\/category\/garden$/)
})
