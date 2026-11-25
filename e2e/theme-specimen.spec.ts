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

test('a page section shows an eyebrow and an anchored heading with its self-link', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  const section = page.locator('section.myc-section[data-section="feature-grid"]:has(#what-you-need)')
  await expect(section).toHaveCount(1)
  await expect(section.locator('.myc-section-head > .myc-eyebrow')).toHaveText('The basics')
  const heading = section.locator('h2#what-you-need')
  await expect(heading).toHaveClass(/myc-section-title/)
  const selfLink = heading.getByRole('link', { name: 'What you need' })
  await expect(selfLink).toHaveAttribute('href', '#what-you-need')
  await expect(section).toHaveAttribute('aria-labelledby', 'what-you-need')
  await selfLink.click()
  await expect(page).toHaveURL(/#what-you-need$/)
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

// Groups and reusable blocks (ADR 0022): the bands of the myc-group hook and a reference drawn as its target
test('shows a group in myc-group with its data-tone', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  const groups = page.locator('.myc-specimen-group[data-section="composition"] .myc-group')
  await expect(groups).toHaveCount(3)
  expect(await groups.evaluateAll(nodes => nodes.map(node => [node.tagName, node.getAttribute('data-tone'), [...node.children].map(child => child.getAttribute('data-section'))]))).toEqual([
    ['DIV', 'default', ['stats']],
    ['DIV', 'raised', ['cta', 'cta']],
    ['DIV', 'accent', ['stats']],
  ])
  // Each tone takes its role's surface, and a member writes no tone of its own (the accent band's stats store `raised`)
  const surfaces = await groups.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))
  expect(new Set(surfaces).size).toBe(3)
  await expect(groups.nth(2).locator('[data-tone]')).toHaveCount(0)
  // The band owns the vertical spacing: its first member yields the top of its own
  await expect(groups.first().locator('> section.myc-section')).toHaveCSS('padding-top', '0px')
})

test('shows a reference as its target under the target\'s own data-section hook, with no root of its own', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  const band = page.locator('.myc-specimen-group[data-section="composition"] .myc-group[data-tone="raised"]')
  const target = band.locator('> section.myc-section[data-section="cta"]', { has: page.getByRole('heading', { name: 'A reusable call to action' }) })
  await expect(target).toBeVisible()
  await expect(target).toHaveAttribute('data-variant', 'card')
  await expect(page.locator('[data-section="composition"] [data-section="reusable"], [data-section="composition"] [data-myc-block]')).toHaveCount(0)
})

// A band whose members all draw nothing is left with Vue's comments alone (a reference without its block, a module that is off):
// it takes no room, while a band with a member keeps its surface
test('takes no room for a band whose members draw nothing', async ({ page }) => {
  await page.goto('/_theme', { waitUntil: 'networkidle' })
  const frame = page.locator('.myc-specimen-group[data-section="composition"] .myc-specimen-frame')
  const [empty, held] = await frame.evaluate((node) => {
    const band = (inner: Node[]): HTMLElement => {
      const element = document.createElement('div')
      element.className = 'myc-group'
      element.dataset.tone = 'accent'
      element.append(...inner)
      node.append(element)
      return element
    }
    const measure = (element: HTMLElement): [string, number] => [getComputedStyle(element).display, element.getBoundingClientRect().height]
    return [measure(band([document.createComment('['), document.createComment(']')])), measure(band([document.createElement('div')]))] as const
  })
  expect(empty).toEqual(['none', 0])
  expect(held[0]).toBe('flow-root')
  expect(held[1]).toBeGreaterThan(0)
})
