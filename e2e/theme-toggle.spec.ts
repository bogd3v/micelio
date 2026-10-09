import { test, expect } from '@playwright/test'

test('follows the system preference on first visit', async ({ browser }) => {
  for (const [colorScheme, theme] of [['light', 'dia'], ['dark', 'noche']] as const) {
    const page = await browser.newPage({ colorScheme })
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await page.close()
  }
})

test('toggles between Noche and Día and persists across reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'dia')
  await page.getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Night' }).click()
  await expect(html).toHaveAttribute('data-theme', 'noche')
  expect(await page.evaluate(() => localStorage.getItem('micelio-theme'))).toBe('noche')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 12, 16)')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(html).toHaveAttribute('data-theme', 'noche')
})

test('applies the stored theme before the first paint', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('micelio-theme', 'noche'))
  await page.goto('/', { waitUntil: 'commit' })
  await page.waitForFunction(() => document.body !== null)
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('noche')
})

test('migrates the legacy color mode preference', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('micelio-theme')) localStorage.setItem('devbog-color-mode', 'dark')
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('micelio-theme'))).toBe('noche')
  expect(await page.evaluate(() => localStorage.getItem('devbog-color-mode'))).toBeNull()
})

test('moves the previous theme key to micelio-theme', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('micelio-theme')) localStorage.setItem('devbog-theme', 'noche')
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('micelio-theme'))).toBe('noche')
  expect(await page.evaluate(() => localStorage.getItem('devbog-theme'))).toBeNull()
})

test('moves the bd-theme key to micelio-theme', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('micelio-theme')) localStorage.setItem('bd-theme', 'noche')
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('micelio-theme'))).toBe('noche')
  expect(await page.evaluate(() => localStorage.getItem('bd-theme'))).toBeNull()
})

test('switches instantly with reduced motion', async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Night' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
  expect(await page.evaluate(() => document.documentElement.classList.contains('myc-vt-theme'))).toBe(false)
  await page.close()
})
