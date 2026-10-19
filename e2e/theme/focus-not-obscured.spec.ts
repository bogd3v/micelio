import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PAGES, openPage } from './support'

// WCAG 2.4.11 (Focus Not Obscured, Minimum): a focused element is not entirely hidden by the fixed tab bar, the header or the privacy notice
const MAX_TABS = 80

/** Selectors of the focused elements whose centre and both sides sit under another element, after each Tab. */
async function coveredWhileTabbing(page: Page): Promise<string[]> {
  const covered: string[] = []
  for (let step = 0; step < MAX_TABS; step++) {
    await page.keyboard.press('Tab')
    const hit = await page.evaluate(() => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      const box = element.getBoundingClientRect()
      if (!box.width || !box.height) return null
      const y = box.top + box.height / 2
      const points = [box.left + box.width / 2, box.left + 1, box.right - 1].map(x => document.elementFromPoint(x, y))
      const blocked = points.every(found => !found || !(element.contains(found) || found.contains(element)))
      return blocked ? `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).trim().split(/\s+/).join('.')}` : ''} "${(element.textContent ?? '').trim().slice(0, 30)}" covered by ${points[0]?.className || points[0]?.tagName}` : null
    })
    if (hit) covered.push(hit)
  }
  return covered
}

for (const entry of PAGES.filter(item => item.name !== 'specimen')) {
  test(`${entry.name} keeps the focused element out from under the fixed layers`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.metadata.viewport !== 'mobile', 'The tab bar only exists on mobile')
    await openPage(page, entry)
    // First visit: the privacy notice is shown over the page
    await expect(page.locator('.myc-privacy-notice')).toBeVisible()
    expect(await coveredWhileTabbing(page), 'with the privacy notice').toEqual([])

    await page.locator('.myc-privacy-notice-ok').click()
    await expect(page.locator('.myc-privacy-notice')).toHaveCount(0)
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      ;(document.activeElement as HTMLElement | null)?.blur()
    })
    expect(await coveredWhileTabbing(page), 'notice dismissed').toEqual([])
  })
}
