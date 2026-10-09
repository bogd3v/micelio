import { test, expect } from '@playwright/test'
import { tabThroughDialog } from './fixtures/focus'

test('opens with the shortcut, searches and opens an article with the keyboard', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await expect(palette).toBeVisible()
  const input = palette.getByRole('combobox', { name: 'Search articles, topics or actions' })
  await expect(input).toBeFocused()

  await input.fill('composables')
  const listbox = palette.getByRole('listbox')
  await expect(listbox.getByRole('group', { name: 'Articles' }).getByRole('option')).toHaveText([/Understanding Vue Composables/])
  await expect(palette.getByRole('status')).toHaveText('1 result')

  await page.keyboard.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-activedescendant', 'article-doc-vue')
  await expect(listbox.getByRole('option', { name: /Understanding Vue Composables/ })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/blog\/understanding-vue-composables$/)
  await expect(palette).toBeHidden()
})

test('searches only the current language', async ({ page }) => {
  await page.goto('/es', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Buscar' }).first().click()
  const palette = page.getByRole('dialog', { name: 'Buscar en BogDev' })
  await palette.getByRole('combobox').fill('composables')
  await expect(palette.getByRole('group', { name: 'Artículos' }).getByRole('option')).toHaveText([/Guía de Vue Composables/])
})

test('toggles with the shortcut and returns focus to the header button', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await page.keyboard.press('ControlOrMeta+k')
  await expect(palette).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(palette).toBeHidden()

  const trigger = page.getByRole('button', { name: 'Search', exact: true }).and(page.locator('.myc-chip'))
  await trigger.click()
  await expect(palette).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('shows the empty state and keeps the actions', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await palette.getByRole('combobox').fill('zzzz')
  await expect(palette.getByText('No results for “zzzz”', { exact: true }).first()).toBeVisible()
  await expect(palette.getByRole('group', { name: 'Actions' }).getByRole('option')).toHaveCount(2)
})

test('runs the theme action from the keyboard', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'dia')
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  const input = palette.getByRole('combobox')
  await expect(input).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(input).toHaveAttribute('aria-activedescendant', 'action-theme')
  await expect(palette.getByRole('option', { name: 'Switch to the Night theme' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(html).toHaveAttribute('data-theme', 'noche')
  await expect(palette).toBeHidden()
})

test('filters by topic from the palette', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await palette.getByRole('combobox').fill('ux')
  await palette.getByRole('option', { name: /Linux and open source/ }).click()
  await expect(page).toHaveURL(/\/blog\/category\/linux$/)
})

test('keeps Tab inside the palette or on the browser UI, never on the page behind', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await expect(palette).toBeVisible()
  await tabThroughDialog(page, palette, 6)
})

test('opens from the mobile tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Search' }).click()
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await expect(palette).toBeVisible()
  await expect(palette.getByRole('combobox')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('also searches the article body and highlights the match in the snippet', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  const articles = palette.getByRole('group', { name: 'Articles' })
  await palette.getByRole('combobox').fill('stateful')
  await expect(palette.getByRole('status')).toHaveText('No results for “stateful”')

  await palette.getByRole('checkbox', { name: 'Also search the content' }).check()
  await expect(articles.getByRole('option')).toHaveText([/Understanding Vue Composables/])
  await expect(articles.locator('.myc-result-snippet')).toHaveText('Composables let you share stateful logic across components.')
  await expect(articles.locator('.myc-result-snippet mark')).toHaveText('stateful')
})
