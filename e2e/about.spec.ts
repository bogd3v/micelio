import { test, expect } from '@playwright/test'

test('renders the field card from Strapi in each locale', async ({ page }) => {
  await page.goto('/es/about', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola, soy Alejandro.')
  await expect(page.getByText('Retired block')).toHaveCount(0)
  await page.goto('/about', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hi, I am Alejandro.')
  await expect(page.getByRole('heading', { name: 'BogDev on the fediverse', level: 3 })).toBeVisible()
})

test('jumps to the projects and opens the search from the guide', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'See projects' }).click()
  await expect(page).toHaveURL(/#projects$/)
  await expect(page.locator('#projects')).toBeInViewport()
  await page.locator('.myc-guide-list').getByRole('link', { name: 'search' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
