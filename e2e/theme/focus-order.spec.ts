import { test, expect } from '@playwright/test'
import { PAGES, openPage } from './support'
import { orderDepartures, tabStops } from '../fixtures/focus'

// WCAG 2.4.3 (Focus Order): Tab follows the reading order, which is the visual order, and the fixed layers (the Back to top button, the
// privacy notice, the tab bar) come after the page, as the sticky header comes before it
const SCROLLED = 400

for (const name of ['home', 'specimen']) {
  test(`${name}: the Tab order follows the visual order`, async ({ page }) => {
    await openPage(page, PAGES.find(entry => entry.name === name)!)
    // First visit: the privacy notice is shown over the page; scrolled, the Back to top button shows too
    await expect(page.locator('.myc-privacy-notice')).toBeVisible()
    await page.evaluate(y => window.scrollTo(0, y), SCROLLED)
    await expect(page.locator('.myc-back-to-top')).toBeVisible()
    const stops = await tabStops(page, SCROLLED)
    expect(stops.length).toBeGreaterThan(20)
    const labels = stops.map(stop => stop.label)
    expect(labels, 'the Back to top button is a stop').toContain('Back to top')
    expect(orderDepartures(stops)).toEqual([])
  })
}
