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

test('the display headings use the chosen font and its file loads', async ({ page }) => {
  const fontResponses: { path: string, status: number }[] = []
  page.on('response', (response) => {
    if (response.url().includes('/fonts/display/')) fontResponses.push({ path: new URL(response.url()).pathname, status: response.status() })
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const heading = await page.locator('main h1, main h2').first().evaluate(element => getComputedStyle(element).fontFamily)
  expect(heading.startsWith('Fraunces, "Fraunces Fallback"')).toBe(true)
  expect(fontResponses).toEqual([{ path: '/fonts/display/fraunces-latin-wght.woff2', status: 200 }])
  expect(await page.evaluate(() => document.fonts.check('600 32px Fraunces', 'Soberanía digital'))).toBe(true)
  expect(await page.evaluate(() => [...document.fonts].filter(face => face.family === 'Fraunces').map(face => face.status))).toEqual(['loaded'])
  // Body text and mono keep the theme's fonts
  const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  expect(body).toMatch(/^Archivo/)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-mono'))).toMatch(/JetBrains Mono/)
})
