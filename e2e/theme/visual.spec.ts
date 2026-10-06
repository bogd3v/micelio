import { test, expect } from '@playwright/test'
import { PAGES, openPage, volatile } from './support'

// Baselines live in e2e/theme/__screenshots__/<theme>/<mode>/<viewport>/ (docs/theme-testing.md)
for (const entry of PAGES.filter(page => page.name !== 'specimen')) {
  test(entry.name, async ({ page }) => {
    await openPage(page, entry)
    await expect(page).toHaveScreenshot(`${entry.name}.png`, { fullPage: true, mask: volatile(page) })
  })
}

// One screenshot per group: a change shows in the group it touches, not in a page-long diff
test('specimen groups', async ({ page }) => {
  await openPage(page, PAGES.find(entry => entry.name === 'specimen')!)
  const ids = await page.locator('[data-section]').evaluateAll(sections => sections.map(section => section.getAttribute('data-section') ?? ''))
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) {
    await expect(page.locator(`[data-section="${id}"]`)).toHaveScreenshot(`specimen/${id}.png`, { mask: volatile(page) })
  }
})
