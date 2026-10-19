import { test, expect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { PAGES, openPage } from './support'

// WCAG 2.4.7 (Focus Visible): the keyboard focus on an article link (a card or a list row) and on the blog search field shows an outline of at least 2 px

interface Outline { style: string, width: number, alpha: number }

/** The outline the browser paints for `target` (or one of its pseudo-elements) once the keyboard has focused `source`. */
async function outlineOf(source: Locator, target: string, pseudo?: string): Promise<Outline> {
  await source.focus()
  await source.page().keyboard.press('Shift+Tab')
  await source.page().keyboard.press('Tab')
  return source.evaluate((element, args) => {
    const owner = args.target === 'self' ? element : element.closest(args.target)!
    const style = getComputedStyle(owner, args.pseudo)
    const alpha = Number(/rgba?\([^,]+,[^,]+,[^,)]+(?:,\s*([\d.]+))?\)/.exec(style.outlineColor)?.[1] ?? 1)
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth), alpha }
  }, { target, pseudo })
}

test('a card link shows a visible focus indicator', async ({ page }) => {
  await openPage(page, PAGES.find(item => item.name === 'blog')!)
  const outline = await outlineOf(page.locator('a.myc-card-link, a.myc-post-row-link').first(), '.myc-card, .myc-post-row')
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThanOrEqual(2)
  expect(outline.alpha).toBeGreaterThan(0)
})

test('the blog search field shows a visible focus indicator', async ({ page }) => {
  await openPage(page, PAGES.find(item => item.name === 'blog')!)
  const outline = await outlineOf(page.locator('.myc-blog-search-input'), '.myc-blog-search', '::before')
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThanOrEqual(2)
  expect(outline.alpha).toBeGreaterThan(0)
})
