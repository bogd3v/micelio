import { test, expect } from '@playwright/test'

// ADR 0021, section 3: the icons of a page are one sprite in its HTML, so a static page (which runs no Vue) draws them with JavaScript off
// and the browser never asks for an icon file. /_theme/icons is the one page of this build with icons (MICELIO_SPECIMEN=1, scripts/test-static.mjs)
test('a static page inlines the sprite and requests no icon file', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const requested: string[] = []
  page.on('request', request => requested.push(new URL(request.url()).pathname))
  await page.goto('/_theme/icons')

  // The specimen's own pictures (/_theme/media/) are not icons
  // One sprite, holding each used name once: the eight names in outline and in filled
  await expect(page.locator('svg#myc-icons')).toHaveCount(1)
  const ids = await page.locator('svg#myc-icons > symbol').evaluateAll(symbols => symbols.map(symbol => symbol.id))
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).toHaveLength(16)
  expect(ids).toContain('myc-i-leaf')
  expect(ids).toContain('myc-i-leaf-filled')

  // Every icon on the page points at a symbol of the sprite, and the decorative ones are hidden from assistive technology
  const uses = await page.locator('[data-section="icons"] svg.myc-icon').evaluateAll(icons => icons.map(icon => ({
    href: icon.querySelector('use')?.getAttribute('href') ?? '',
    hidden: icon.getAttribute('aria-hidden'),
    label: icon.getAttribute('aria-label'),
  })))
  expect(uses.length).toBeGreaterThan(16)
  for (const { href } of uses) expect(ids).toContain(href.slice(1))
  expect(uses.filter(({ hidden }) => hidden === 'true')).toHaveLength(uses.length - 1)
  expect(uses.filter(({ label }) => label)).toHaveLength(1)

  expect(requested.filter(path => (/\.svg$/.test(path) && !/\/_?media\//.test(path)) || /\/icons?\//.test(path))).toEqual([])
  await context.close()
})

// A page that uses no icon is the page it was: no sprite
test('a static page with no icon has no sprite', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#myc-icons')).toHaveCount(0)
})
