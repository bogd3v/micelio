import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PRIVACY_NOTICE_STORAGE_KEY } from '../../app/helpers/privacy'
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

// The specimen has more than 140 stops: the loop runs until focus leaves the page, and fails if it never does
const MAX_TABS_LONG = 400

/**
 * Labels of the focused elements the Back to top button sits over (the centre of the element is under it), after each Tab, with the button shown. A stop is checked where the
 * scroll left it and, if it is in the button's columns, again after the page is scrolled so that the stop lies under the button: a stop
 * already in view takes focus without the browser moving it, so whether the button covers it depends on where the reader had scrolled.
 */
async function coveredByBackToTop(page: Page): Promise<string[]> {
  const covered: string[] = []
  for (let step = 0; step < MAX_TABS_LONG; step++) {
    await page.keyboard.press('Tab')
    const hits = await page.evaluate(() => {
      const element = document.activeElement
      const button = document.querySelector<HTMLElement>('.myc-back-to-top')
      if (!element || element === document.body) return null
      if (!button || button.contains(element)) return []
      const name = `${element.tagName.toLowerCase()} "${(element.textContent ?? '').trim().slice(0, 30)}"`
      // The box of the button as laid out: its scale (it folds away while focus is elsewhere) leaves its centre where it is
      const centre = button.getBoundingClientRect()
      const buttonX = centre.left + centre.width / 2
      const buttonY = centre.top + centre.height / 2
      const covers = (): boolean => {
        const box = element.getBoundingClientRect()
        if (!box.width || !box.height) return false
        // The centre is under the button: a small control (the 26 px "Text" button) is hidden by a part of the circle, not only by all of it
        const found = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        return !!found && button.contains(found)
      }
      const result: string[] = []
      if (covers()) result.push(name)
      const box = element.getBoundingClientRect()
      if (box.right > buttonX - button.offsetWidth / 2 && box.left < buttonX + button.offsetWidth / 2) {
        window.scrollBy(0, box.top + box.height / 2 - buttonY)
        if (covers()) result.push(`${name} scrolled under the button`)
      }
      return result
    })
    if (!hits) return covered
    covered.push(...hits)
  }
  throw new Error(`Focus never left the page in ${MAX_TABS_LONG} Tab presses`)
}

test('no focus stop is hidden by the Back to top button, notice shown and dismissed', async ({ page }) => {
  // Five pages, each tabbed twice (up to 170 stops): the default 60 s is short for it when the workers share a CPU
  test.setTimeout(240_000)
  for (const entry of PAGES) {
    await openPage(page, entry)
    // The notice is shown on a first visit: forget the dismissal of the page before
    await page.evaluate(key => localStorage.removeItem(key), PRIVACY_NOTICE_STORAGE_KEY)
    await page.reload()
    await expect(page.locator('.myc-privacy-notice')).toBeVisible()
    expect(await coveredByBackToTop(page), `${entry.name}, with the privacy notice`).toEqual([])

    await page.locator('.myc-privacy-notice-ok').click()
    await expect(page.locator('.myc-privacy-notice')).toHaveCount(0)
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      ;(document.activeElement as HTMLElement | null)?.blur()
    })
    expect(await coveredByBackToTop(page), `${entry.name}, notice dismissed`).toEqual([])
  }
})
