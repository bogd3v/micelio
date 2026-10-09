import { test, expect } from '@playwright/test'
import { tabThroughDialog } from './fixtures/focus'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

test('shows the tab bar without horizontal scroll', async ({ page }) => {
  for (const path of ['/', '/blog', '/about', '/blog/understanding-vue-composables']) {
    await page.goto(path, { waitUntil: 'networkidle' })
    const tabs = page.getByRole('navigation', { name: 'Bottom navigation' })
    await expect(tabs).toBeVisible()
    await expect(tabs).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('keeps the footer clear of the tab bar', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const footer = await page.locator('footer').last().boundingBox()
  const tabs = await page.getByRole('navigation', { name: 'Bottom navigation' }).boundingBox()
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(tabs!.y + 1)
})

test('navigates with the tab bar', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const tabs = page.getByRole('navigation', { name: 'Bottom navigation' })
  await expect(tabs.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  await tabs.getByRole('link', { name: 'Blog' }).click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(tabs.getByRole('link', { name: 'Blog' })).toHaveAttribute('aria-current', 'page')
  await tabs.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('opens the menu sheet and closes it with the button, Esc and the backdrop', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const menuTab = page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' })
  const sheet = page.getByRole('dialog', { name: 'Menu' })

  await menuTab.click()
  await expect(sheet).toBeVisible()
  await expect(menuTab).toHaveAttribute('aria-expanded', 'true')
  await sheet.getByRole('button', { name: 'Close menu' }).click()
  await expect(sheet).toBeHidden()
  await expect(menuTab).toBeFocused()
  await expect(menuTab).toHaveAttribute('aria-expanded', 'false')

  await menuTab.click()
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(menuTab).toBeFocused()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(sheet).toBeVisible()
  await page.mouse.click(195, 20)
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused()
})

test('keeps Tab inside the sheet or on the browser UI, never on the page behind', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' }).click()
  const sheet = page.getByRole('dialog', { name: 'Menu' })
  await expect(sheet).toBeVisible()
  await tabThroughDialog(page, sheet, 20)
})

test('closes the sheet when swiped down', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' }).click()
  const sheet = page.getByRole('dialog', { name: 'Menu' })
  await expect(sheet).toBeVisible()
  const grip = await sheet.locator('.myc-sheet-handle').boundingBox()
  const x = grip!.x + grip!.width / 2
  const y = grip!.y + grip!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 60, { steps: 4 })
  await page.mouse.move(x, y + 160, { steps: 4 })
  await page.mouse.up()
  await expect(sheet).toBeHidden()
})

test('navigates from the sheet and filters by topic', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const menuTab = page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' })
  const sheet = page.getByRole('dialog', { name: 'Menu' })

  await menuTab.click()
  await sheet.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'About' }).click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(sheet).toBeHidden()

  await menuTab.click()
  await sheet.getByRole('link', { name: 'Linux' }).click()
  await expect(page).toHaveURL(/\/blog\/category\/linux$/)
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toBeVisible()
})

test('changes theme and language from the sheet', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const menuTab = page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' })
  await menuTab.click()
  const sheet = page.getByRole('dialog', { name: 'Menu' })
  await sheet.getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Night' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'noche')
  await sheet.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click()
  await expect(page).toHaveURL(/\/es$/)
  await expect(page.getByRole('dialog', { name: 'Menú' })).toBeHidden()
})

test('keeps the blog filters when switching language from the sheet', async ({ page }) => {
  await page.goto('/blog/tag/vue?sort=fediverse', { waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click()
  await expect(page).toHaveURL(/\/es\/blog\/tag\/vue\?sort=fediverse$/)
})

test('hides the tab bar on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.getByRole('navigation', { name: 'Bottom navigation' })).toBeHidden()
  expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe('0px')
})
