import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PAGES, openPage } from './support'

// The privacy notice floats over a corner of the page from 768 px: while it shows, the end of the page must scroll clear of it (WCAG 2.4.11)
const VIEWPORTS = [{ width: 800, height: 900 }, { width: 1280, height: 800 }]

/** Descriptions of the footer's text, links and controls whose box meets the notice's. */
async function underNotice(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const notice = document.querySelector('.myc-privacy-notice')!.getBoundingClientRect()
    const meets = (box: DOMRect): boolean => box.width > 0 && box.height > 0 && box.left < notice.right && box.right > notice.left && box.top < notice.bottom && box.bottom > notice.top
    const found: string[] = []
    for (const footer of document.querySelectorAll('footer')) {
      for (const control of footer.querySelectorAll('a, button, input, select, textarea, [tabindex]')) {
        if (meets(control.getBoundingClientRect())) found.push(`${control.tagName.toLowerCase()} "${(control.textContent ?? '').trim().slice(0, 30)}"`)
      }
      const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = (node.textContent ?? '').trim()
        if (!text) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        if (Array.from(range.getClientRects()).some(meets)) found.push(`text "${text.slice(0, 30)}"`)
      }
    }
    return found
  })
}

for (const entry of PAGES.filter(item => item.name !== 'specimen')) {
  for (const viewport of VIEWPORTS) {
    test(`${entry.name} ends clear of the privacy notice at ${viewport.width} px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.metadata.viewport !== 'desktop', 'The project sets the width itself; the phone layout is in e2e/mobile-nav.spec.ts')
      await page.setViewportSize(viewport)
      await openPage(page, entry)
      await expect(page.locator('.myc-privacy-notice')).toBeVisible()
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expect.poll(() => page.evaluate(() => Math.round(window.scrollY + window.innerHeight)), 'scrolled to the end').toBeGreaterThanOrEqual(await page.evaluate(() => document.documentElement.scrollHeight) - 1)
      expect(await underNotice(page), 'footer content under the notice').toEqual([])
    })
  }

  test(`${entry.name} adds no room at the end of the page once the notice is dismissed`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.metadata.viewport !== 'desktop', 'The project sets the width itself')
    await openPage(page, entry)
    await page.locator('.myc-privacy-notice-ok').click()
    await expect(page.locator('.myc-privacy-notice')).toHaveCount(0)
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe('0px')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom)).toBe('0px')
  })
}
