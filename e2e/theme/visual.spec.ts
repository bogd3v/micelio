import { test, expect } from '@playwright/test'
import { PAGES, openPage, volatile } from './support'

// Baselines live in e2e/theme/__screenshots__/<theme>/<mode>/<viewport>/ (docs/theme-testing.md)

// The fixed privacy notice would cover content in every shot; axe still checks it (a11y.spec.ts)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('micelio-privacy-notice', '1'))
})

for (const entry of PAGES.filter(page => page.name !== 'specimen')) {
  test(entry.name, async ({ page }) => {
    await openPage(page, entry)
    await expect(page).toHaveScreenshot(`${entry.name}.png`, { fullPage: true, mask: volatile(page) })
  })
}

// The page's fixed chrome lands on a group wherever the scroll leaves it; the full-page shots cover it
const FIXED_CHROME = '.bd-app > .bd-header, .bd-tabbar, .bd-back-to-top { visibility: hidden !important; }'

// One screenshot per group: a change shows in the group it touches, not in a page-long diff
test('specimen groups', async ({ page }) => {
  await openPage(page, PAGES.find(entry => entry.name === 'specimen')!)
  await page.addStyleTag({ content: FIXED_CHROME })
  const ids = await page.locator('.bd-specimen-group[data-section]').evaluateAll(sections => sections.map(section => section.getAttribute('data-section') ?? ''))
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) {
    await expect(page.locator(`[data-section="${id}"]`)).toHaveScreenshot(`specimen/${id}.png`, { mask: volatile(page) })
  }
})
