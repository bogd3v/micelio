import { test, expect } from '@playwright/test'
import { MOTION_PAGES, accountToggle, open, runningAnimations, scrollThrough, signInAsReader } from './support'

// prefers-reduced-motion: reduce shows no animation anywhere (ADR 0005, section 10; #245).
// Projects `<mode>-reduced`: the modes of the theme, Chromium with every native API on.

for (const entry of MOTION_PAGES) {
  test(`${entry.name} runs no animation after load and while scrolling`, async ({ page }) => {
    await open(page, entry)
    expect(await runningAnimations(page)).toEqual([])
    await scrollThrough(page)
    expect(await runningAnimations(page)).toEqual([])
  })
}

test('the theme switch changes the mode without animations', async ({ page }) => {
  await open(page, MOTION_PAGES[0]!)
  const other = page.locator('.bd-seg[data-mode][aria-pressed="false"]:visible').first()
  test.skip(!(await other.count()), 'the theme has a single mode')
  const before = await page.locator('html').getAttribute('data-theme')
  await other.click()
  expect(await runningAnimations(page)).toEqual([])
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before!)
  expect(await runningAnimations(page)).toEqual([])
})

test('the search palette opens and closes without animations', async ({ page }) => {
  await open(page, MOTION_PAGES[0]!)
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await page.keyboard.press('ControlOrMeta+k')
  expect(await runningAnimations(page)).toEqual([])
  await expect(palette).toBeVisible()
  expect(await runningAnimations(page)).toEqual([])
  await page.keyboard.press('Escape')
  expect(await runningAnimations(page)).toEqual([])
  await expect(palette).toBeHidden()
  expect(await runningAnimations(page)).toEqual([])
})

test.describe('menu sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('opens and closes without animations', async ({ page }) => {
    await open(page, MOTION_PAGES[0]!)
    const sheet = page.getByRole('dialog', { name: 'Menu' })
    await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' }).click()
    expect(await runningAnimations(page)).toEqual([])
    await expect(sheet).toBeVisible()
    expect(await runningAnimations(page)).toEqual([])
    await page.keyboard.press('Escape')
    expect(await runningAnimations(page)).toEqual([])
    await expect(sheet).toBeHidden()
    expect(await runningAnimations(page)).toEqual([])
  })
})

test('the account menu opens and closes without animations', async ({ page, baseURL }) => {
  await signInAsReader(page, baseURL)
  await open(page, { name: 'blog', path: '/blog' })
  const toggle = accountToggle(page)
  await toggle.click()
  const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`)
  expect(await runningAnimations(page)).toEqual([])
  await expect(panel).toBeVisible()
  expect(await runningAnimations(page)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  expect(await runningAnimations(page)).toEqual([])
})
