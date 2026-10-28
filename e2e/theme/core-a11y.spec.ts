import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PAGES, openPage } from './support'

// Core markup that every theme renders the same way (bogd3v/micelio#782): the Spanish article's citations, the specimen's frames
// and the focus indicator of the post-list variants. Axe and the line-by-line manual check are in docs/themes/accessibility-checklist.md

const SPANISH_ARTICLE = { name: 'article-es', path: '/es/blog/guia-vue-composables' }
const specimen = PAGES.find(item => item.name === 'specimen')!

async function openSpecimen(page: Page): Promise<void> {
  // The frames are adjusted when the page mounts (modules/theme/specimen/page.vue); `openPage` waits for hydration
  await openPage(page, specimen)
}

test('the Spanish article has no axe violations, citations included', async ({ page }) => {
  await openPage(page, SPANISH_ARTICLE)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)).toEqual([])
})

test('the links of the reference list and the citations are named by their visible text', async ({ page }) => {
  await openPage(page, SPANISH_ARTICLE)
  const links = page.locator('.myc-prose a.myc-cite, #references a.myc-ref-back')
  await expect(links).toHaveCount(9)
  for (const link of await links.all()) {
    const visible = (await link.textContent())!.replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase()
    // As a whole word: "Referencia 12" must not pass for "[1]"
    expect((await link.getAttribute('aria-label'))!.toLowerCase()).toMatch(new RegExp(`(^|[^\\p{L}\\p{N}])${visible}($|[^\\p{L}\\p{N}])`, 'u'))
  }
  await expect(page.locator('#ref-2').getByRole('link', { name: 'Volver al texto, cita 2' })).toBeVisible()
})

test('the specimen has one h1: the frames\' copies read as level-4 headings', async ({ page }) => {
  await openSpecimen(page)
  const levelOne = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'))
    .filter(heading => !heading.closest('[hidden],[aria-hidden="true"],[inert]'))
    .filter(heading => Number(heading.getAttribute('aria-level') ?? heading.tagName[1]) === 1)
    .map(heading => heading.textContent!.trim()))
  expect(levelOne).toHaveLength(1)
  // The copies are still there, as `h1` elements of the markup (a theme's CSS hooks on them)
  expect(await page.locator('.myc-specimen-frame h1').count()).toBeGreaterThan(0)
})

test('the buttons of the specimen\'s header copies cannot take focus', async ({ page }) => {
  await openSpecimen(page)
  const buttons = page.locator('.myc-specimen-frame button[aria-haspopup="dialog"]')
  // The search and menu triggers of every header variant: a blind test would pass on none
  expect(await buttons.count()).toBeGreaterThan(0)
  for (const button of await buttons.all()) {
    expect(await button.evaluate((element: HTMLElement) => element.inert)).toBe(true)
    // `focus()` on an inert element does nothing
    await button.evaluate(element => element.focus())
    expect(await button.evaluate(element => element === document.activeElement)).toBe(false)
  }
  // Tabbing through the whole specimen never lands in one
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const total = await page.evaluate(() => document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]').length)
  for (let step = 0; step < total; step++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.matches('.myc-specimen-frame button[aria-haspopup="dialog"]'))).toBe(false)
  }
})

/**
 * How many pixels around `row` change by a contrast of 3:1 or more when the keyboard focuses `link` (WCAG 1.4.11).
 * The outline sits outside the row, so the clip is wider than its box.
 */
async function indicatorPixels(page: Page, link: Locator, row: Locator): Promise<{ pixels: number, edge: number }> {
  await link.scrollIntoViewIfNeeded()
  const box = (await row.boundingBox())!
  const clip = { x: Math.max(0, box.x - 8), y: box.y - 8, width: box.width + 16, height: box.height + 16 }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const before = (await page.screenshot({ clip })).toString('base64')
  await link.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  expect(await link.evaluate(element => element.matches(':focus-visible'))).toBe(true)
  const after = (await page.screenshot({ clip })).toString('base64')
  const pixels = await page.evaluate(async ([first, second]) => {
    async function read(png: string): Promise<Uint8ClampedArray> {
      const bytes = Uint8Array.from(atob(png), character => character.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      return context.getImageData(0, 0, bitmap.width, bitmap.height).data
    }
    function luminance(data: Uint8ClampedArray, index: number): number {
      const [red, green, blue] = [0, 1, 2].map((offset) => {
        const channel = data[index + offset]! / 255
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
    }
    const [one, two] = [await read(first!), await read(second!)]
    let count = 0
    for (let index = 0; index < one.length; index += 4) {
      const [high, low] = [luminance(one, index), luminance(two, index)].sort((a, b) => b! - a!)
      if ((high! + 0.05) / (low! + 0.05) >= 3) count++
    }
    return count
  }, [before, after])
  return { pixels, edge: Math.round(box.width) }
}

for (const forcedColors of ['none', 'active'] as const) {
  test(`the log and row post-list variants show a focus indicator of 3:1 (forced colors ${forcedColors})`, async ({ page }) => {
    await page.emulateMedia({ forcedColors })
    await openSpecimen(page)
    const log = page.locator('.myc-log-link').first()
    const rows = page.locator('.myc-post-row-link').first()
    for (const link of [log, rows]) {
      const { pixels, edge } = await indicatorPixels(page, link, link.locator('xpath=ancestor::li[1]'))
      // At least one whole edge of the row: a stray changed pixel (a hover, a transition) is not an indicator
      expect(pixels).toBeGreaterThanOrEqual(edge)
    }
  })
}
