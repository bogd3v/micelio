import { test, expect } from '@playwright/test'

// Runs on both themes (scripts/test-landing.mjs): the default theme has the bar header, starter the centered one
// The header keeps its links on one line at every width: fewer anchors below 1280 px, never a wrapped label
for (const width of [768, 1024, 1280, 1440]) {
  test(`no landing link of the header wraps at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    const links = page.locator('.myc-nav-links > li:visible > .myc-nav-link')
    const count = await links.count()
    expect(count).toBeGreaterThanOrEqual(width >= 1280 ? 6 : 4)
    const boxes = await links.evaluateAll(items => items.map(item => ({ height: item.getBoundingClientRect().height, line: Number.parseFloat(getComputedStyle(item).lineHeight) || 0, right: item.getBoundingClientRect().right })))
    // One line: no taller than 1.5 lines of text, or than the 44px touch target when that is larger
    for (const box of boxes) expect(box.height).toBeLessThanOrEqual(Math.max(box.line * 1.5, 48))
    // And nothing runs past the viewport
    expect(Math.max(...boxes.map(box => box.right))).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
