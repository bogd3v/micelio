import { test, expect } from '@playwright/test'

// A static build has no client JS: the percentage and the back-to-top link run on scroll timelines (#245).
// Run it on every browser with STATIC_BROWSERS=chromium,webkit,firefox; Firefox has no scroll timelines.
const ARTICLE = '/blog/understanding-vue-composables'

async function supportsTimelines(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => CSS.supports('animation-timeline: scroll()'))
}

async function count(page: import('@playwright/test').Page): Promise<number> {
  return Number(await page.locator('.bd-strip-read-num').evaluate(el => getComputedStyle(el).getPropertyValue('--myc-read-count')))
}

test('the reading percentage follows the scroll with no script on the page', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  test.skip(!(await supportsTimelines(page)), 'no scroll timelines in this browser: the text stays at 0')
  expect(await page.locator('script[src*="_nuxt"]').count()).toBe(0)
  await expect.poll(() => count(page)).toBe(0)
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2))
  await expect.poll(() => count(page)).toBeGreaterThan(40)
  expect(await count(page)).toBeLessThan(60)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => count(page)).toBe(100)
})

test('the translated words stay around the number', async ({ page }) => {
  await page.goto('/es/blog/guia-vue-composables', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-strip-read')).toContainText('Leído')
  await expect(page.locator('.bd-strip-read-num')).toHaveAttribute('data-percent', '0')
})

test('back to top is a link that shows past 200px', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  test.skip(!(await supportsTimelines(page)), 'no scroll timelines in this browser: the link stays hidden')
  const back = page.getByRole('link', { name: 'Back to top' })
  await expect(back).toBeHidden()
  await page.evaluate(() => window.scrollTo(0, 800))
  await expect(back).toBeVisible()
  await back.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('without scroll timelines the read indicator is hidden instead of stuck at 0 %', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  test.skip(await supportsTimelines(page), 'needs a browser without scroll timelines (STATIC_BROWSERS=firefox)')
  await expect(page.locator('.bd-strip-read')).toBeHidden()
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the percentage still updates and the link still appears', async ({ page }) => {
    await page.goto(ARTICLE, { waitUntil: 'networkidle' })
    test.skip(!(await supportsTimelines(page)), 'no scroll timelines in this browser')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => count(page)).toBe(100)
    const back = page.getByRole('link', { name: 'Back to top' })
    await expect(back).toBeVisible()
    // A step, not a fade: no opacity between hidden and shown
    expect(await back.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
  })
})
