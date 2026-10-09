import { test, expect, type Page } from '@playwright/test'
import { testUsers } from './fixtures/auth.mjs'

async function signIn(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/account/sign-in', { waitUntil: 'networkidle' })
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/account$/)
}

const draftPaths = ['/drafts', '/es/drafts', '/drafts/doc-linux?locale=en', '/es/drafts/doc-draft-pihole?locale=es']

test('answers 404 to visitors without a session', async ({ page }) => {
  for (const path of draftPaths) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(404)
  }
})

test('answers 404 to readers', async ({ page }) => {
  await signIn(page, testUsers.reader.username, testUsers.reader.password)
  for (const path of draftPaths) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(404)
  }
})

test('lists the drafts for an editor and filters them by state', async ({ page }) => {
  await signIn(page, testUsers.editor.username, testUsers.editor.password)
  const response = await page.goto('/drafts', { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
  expect(response?.headers()['cache-control']).toBe('private, no-store')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')

  await expect(page.getByRole('heading', { level: 1, name: 'Drafts' })).toBeVisible()
  const rows = page.locator('.myc-drafts-table tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Pi-hole en una Raspberry Pi')
  await expect(rows.nth(0)).toContainText('Never published')
  await expect(rows.nth(0)).toContainText('ES')
  await expect(rows.nth(0)).toContainText('28.09.2026 · 18:42')
  await expect(rows.nth(1)).toContainText('Published with changes')
  await expect(rows.nth(1).locator('.myc-tag-linux')).toBeVisible()

  const filters = page.getByRole('group', { name: 'Filter drafts' })
  await filters.getByRole('button', { name: /^With changes/ }).click()
  await expect(filters.getByRole('button', { name: /^With changes/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(rows).toHaveCount(1)
  await expect(rows.nth(0)).toContainText('Linux Server Hardening Guide, second edition')

  await page.getByRole('button', { name: `Your account menu, ${testUsers.editor.username}` }).first().click()
  await expect(page.getByRole('link', { name: 'Drafts, 2 to review' })).toBeVisible()
})

test('opens a draft with the draft strip and without the public extras', async ({ page }) => {
  await signIn(page, testUsers.editor.username, testUsers.editor.password)
  await page.goto('/drafts', { waitUntil: 'networkidle' })
  await page.locator('.myc-drafts-table').getByRole('link', { name: 'Review the draft Linux Server Hardening Guide, second edition' }).click()
  await expect(page).toHaveURL(/\/drafts\/doc-linux\?locale=en$/)

  const strip = page.getByRole('status').filter({ hasText: 'Only editors can see it.' })
  await expect(strip).toContainText('Draft')
  await expect(strip).toContainText('It has unpublished changes.')
  await expect(strip).toContainText('Last edited 27.09.2026 · 09:15')
  await expect(strip.getByRole('link', { name: /View published version/ })).toHaveAttribute('href', '/blog/linux-server-hardening-guide')
  await expect(page.getByRole('heading', { level: 1, name: 'Linux Server Hardening Guide, second edition' })).toBeVisible()
  await expect(page.locator('.myc-prose')).toContainText('Start with SSH keys and a firewall.')

  await expect(page.locator('#comments, .myc-related, .myc-article-share, .myc-article-actions, .myc-fedi-bar')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0)
})

test('shows a never published draft in its own language', async ({ page }) => {
  await signIn(page, testUsers.editor.username, testUsers.editor.password)
  const response = await page.goto('/es/drafts/doc-draft-pihole?locale=es', { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
  expect(response?.headers()['cache-control']).toBe('private, no-store')
  const strip = page.getByRole('status').filter({ hasText: 'Solo lo ven los editores.' })
  await expect(strip).toContainText('Nunca se ha publicado.')
  await expect(strip.getByRole('link', { name: /Ver versión publicada/ })).toHaveCount(0)
  await expect(strip.getByRole('link', { name: /Borradores/ })).toHaveAttribute('href', '/es/drafts')
  await expect(page.getByRole('heading', { level: 1, name: 'Pi-hole en una Raspberry Pi' })).toBeVisible()
})
