import { test, expect } from '@playwright/test'
import { PAGES, openPage } from './support'

// WCAG 1.4.10 (Reflow): no horizontal scrolling at a 320 px viewport
const WIDTH = 320

for (const entry of PAGES.filter(item => item.name !== 'specimen')) {
  test(`${entry.name} does not scroll horizontally at ${WIDTH} px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.metadata.viewport !== 'mobile', 'The project sets the width itself; one run per mode is enough')
    await page.setViewportSize({ width: WIDTH, height: 700 })
    await openPage(page, entry)
    const overflow = await page.evaluate(() => {
      const root = document.documentElement
      const edge = root.clientWidth
      const wide = Array.from(document.body.querySelectorAll('*'))
        .filter((element) => {
          const box = element.getBoundingClientRect()
          // Content clipped by its own scroller (a carousel, a code block) scrolls inside it, not the page
          return box.width > 0 && box.right > edge + 0.5 && !element.closest('[data-scroll], pre, table, .myc-scroll-x')
        })
        .slice(0, 8)
        .map(element => `${element.tagName.toLowerCase()}.${String(element.className).trim().split(/\s+/).join('.')} right=${Math.round(element.getBoundingClientRect().right)}`)
      return { scrollWidth: root.scrollWidth, clientWidth: edge, wide }
    })
    expect(overflow.scrollWidth, `elements past the edge: ${overflow.wide.join(' | ')}`).toBeLessThanOrEqual(overflow.clientWidth)
  })
}
