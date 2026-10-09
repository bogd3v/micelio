import { test, expect } from '@playwright/test'

// Dynamic mode keeps its scroll JS: the CSS counter and the link of the static build (e2e/static/scroll-progress.spec.ts) are not in the page
const ARTICLE = '/blog/understanding-vue-composables'

test('the reading percentage is text kept by the scroll listener', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __scrollListeners: number }
    w.__scrollListeners = 0
    const add = window.addEventListener.bind(window)
    window.addEventListener = ((type: string, ...rest: unknown[]) => {
      if (type === 'scroll') w.__scrollListeners++
      return (add as (...args: unknown[]) => void)(type, ...rest)
    }) as typeof window.addEventListener
  })
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  const read = page.locator('.myc-strip-read')
  await expect(read).toHaveText('Read 0 %')
  await expect(page.locator('.myc-strip-read-num')).toHaveCount(0)
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2))
  await expect(read).toHaveText(/^Read (?:49|50|51) %$/)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(read).toHaveText('Read 100 %')
  expect(await page.evaluate(() => (window as unknown as { __scrollListeners: number }).__scrollListeners)).toBeGreaterThan(0)
})

test('back to top is a button that exists only after scrolling', async ({ page }) => {
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  const back = page.getByRole('button', { name: 'Back to top' })
  await expect(back).toHaveCount(0)
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect(back).toBeVisible()
  await expect(page.locator('a.myc-back-to-top')).toHaveCount(0)
  await back.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await expect(back).toHaveCount(0)
})
