import { test, expect } from '@playwright/test'

// Run by playwright.theme-overrides.config.ts: the mock's site-setting sets defaultMode "dia" and a #202020 accent for "noche"

test('the default mode wins over the system preference', async ({ browser }) => {
  const page = await browser.newPage({ colorScheme: 'dark' })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dia')
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'light')
  await page.close()
})

test('the visitor\'s stored choice wins over the default mode', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bd-theme', 'noche'))
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
  await expect(page.locator('html')).toHaveAttribute('data-mode-default', 'dia')
})

test('applies the corrected accent in the mode it was set for only', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bd-theme', 'noche'))
  await page.goto('/', { waitUntil: 'networkidle' })
  const accent = (): Promise<string> => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase())
  const corrected = await accent()
  expect(corrected).toMatch(/^#[\da-f]{6}$/)
  expect(corrected).not.toBe('#202020')
  await expect(page.locator('style#theme-overrides')).toHaveCount(1)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dia'))
  expect(await accent()).not.toBe(corrected)
})
