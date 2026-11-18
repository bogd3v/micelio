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
  await expect(page.locator('[data-section="prose"] .myc-mermaid-diagram svg')).toHaveCount(2)
})

test('renders every page section through the real components', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  for (const kind of PAGE_SECTIONS) {
    await expect(page.locator(`.myc-specimen-group[data-section="page-${kind}"] section.myc-section[data-section="${kind}"]`).first()).toBeVisible()
  }
  // 29 variants + rich-text, each once (the newsletter is on in the e2e site)
  await expect(page.locator('.myc-specimen-group[data-section^="page-"] section.myc-section')).toHaveCount(30)
})

test('is not indexable', async ({ page, request }) => {
  const response = await request.get('/_theme')
  expect(response.status()).toBe(200)
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')
  await page.goto('/_theme')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
})

test('keeps the active header\'s height although the alternate header\'s CSS is bundled', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/_theme')
  // The e2e build uses Bogotá: the bar (136px on desktop), not the centered header's 152px
  await expect(page.locator('html')).toHaveAttribute('data-layout-header', 'bar')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--myc-header-h').trim())).toBe('136px')
})

test('follows the color mode toggle', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  await page.locator('[data-section="controls"]').getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Night' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
})

test('shows six neutral categories whose colors use every role and wrap to the first', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  const tags = page.locator('[data-section="labels"] .myc-specimen-row').first().locator('.myc-tag')
  await expect(tags).toHaveText(['Garden', 'Kitchen', 'Travel', 'Music', 'Books', 'Workshop'])
  const colors = await tags.evaluateAll(elements => elements.map(element => (element as HTMLElement).style.getPropertyValue('--tag-color')))
  expect(colors).toEqual(['var(--category-1)', 'var(--category-2)', 'var(--category-3)', 'var(--category-4)', 'var(--category-5)', 'var(--category-1)'])
})

test('draws the illustrations of the theme, one per slug it ships art for', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  const row = page.locator('[data-specimen="illustrations"]')
  const count = await row.count()
  // A theme with no art (the starter) has no row; one with art (bogota) shows each picture
  if (count) await expect(row.locator('svg')).not.toHaveCount(0)
})

// ADR 0021, section 3: the server inlines one sprite with the names the page uses; no icon file is requested and the CSP is the page's own
test('draws its icons from one inline sprite, with no icon request', async ({ page }) => {
  const requested: string[] = []
  page.on('request', request => requested.push(new URL(request.url()).pathname))
  const response = await page.goto('/_theme', { waitUntil: 'networkidle' })
  expect(await page.locator('body > svg#myc-icons').count()).toBe(1)
  expect(await page.locator('svg#myc-icons > symbol').count()).toBe(16)
  const icon = page.locator('[data-specimen="icons-outline"] svg.myc-icon').first()
  const box = await icon.boundingBox()
  expect(box?.width).toBeGreaterThan(8)
  // The glyph is drawn: its path is in the symbol the use points at, and the stroke follows the text color
  await expect(page.locator('#myc-i-leaf path').first()).toHaveAttribute('d', /.+/)
  expect(requested.filter(path => (/\.svg$/.test(path) && !/\/_?media\//.test(path)) || /\/icons?\//.test(path))).toEqual([])
  expect(response?.headers()['content-security-policy']).not.toMatch(/icon/i)
})
