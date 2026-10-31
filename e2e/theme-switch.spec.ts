import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import type { ThemeStatus } from '../app/interfaces/theme'

// Run by playwright.theme-switch.config.ts: the build's built-in store holds its own theme and the data-only fixture, which the server starts on.
// The mock Strapi names another theme while the server runs; the site must follow it with no restart and no rebuild (#403).
test.skip(!process.env.E2E_BUILD, 'Needs the build made for Bogotá: MICELIO_THEME_DIRS=test/fixtures/themes/alternates MICELIO_SPECIMEN=1 npm run build, then E2E_BUILD=1')
test.describe.configure({ mode: 'serial' })

const MOCK = `http://127.0.0.1:${Number(process.env.E2E_MOCK_PORT ?? 4336)}`

async function status(request: APIRequestContext): Promise<ThemeStatus> {
  return (await request.get('/api/theme/status')).json() as Promise<ThemeStatus>
}

/** Tells the mock which theme the site settings name, then reads the site as a visitor would, which hands the settings to the switch. */
async function name(request: APIRequestContext, theme: Record<string, string>): Promise<void> {
  expect((await request.post(`${MOCK}/__mock/theme`, { data: theme })).ok()).toBe(true)
  await request.get('/api/site')
}

test('starts on the default theme the server was started with', async ({ request }) => {
  const { active, requested, error, available } = await status(request)
  expect(active.id).toBe('alternates')
  expect(requested).toBeNull()
  expect(error).toBeNull()
  expect(available.builtIn.map(theme => theme.id)).toContain('alternates')
  expect(available.builtIn.length).toBeGreaterThan(1)
})

test('follows the theme the site settings name, with no restart and no rebuild, and keeps the old digest served', async ({ page, request }) => {
  const before = await status(request)
  const target = before.available.builtIn.find(theme => theme.id !== before.active.id)!
  await name(request, { themeId: target.id })
  await expect.poll(async () => (await status(request)).active.id).toBe(target.id)
  const after = await status(request)
  expect(after.active.digest).not.toBe(before.active.digest)
  expect(after.requested).toEqual({ id: target.id })
  expect(after.lastGood?.digest).toBe(before.active.digest)
  expect(after.error).toBeNull()
  // A new page names the new theme's stylesheet; the site-settings cache (1 s here) is dropped by the switch
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator(`link[rel="stylesheet"][href="/_t/${after.active.digest}/theme.css"]`)).toHaveCount(1)
  await expect(page.locator(`link[href*="/_t/${before.active.digest}/"]`)).toHaveCount(0)
  // A page cached or open before the switch still finds its files
  expect((await request.get(`/_t/${before.active.digest}/theme.css`)).status()).toBe(200)
  expect((await request.get(`/_t/${after.active.digest}/theme.css`)).headers()['content-type']).toContain('text/css')
})

test('keeps the current theme and says why for an unknown theme and for an invalid pin', async ({ page, request }) => {
  const before = await status(request)
  await name(request, { themeId: 'does-not-exist' })
  await expect.poll(async () => (await status(request)).error?.rule).toBe('unknown')
  expect((await status(request)).active.digest).toBe(before.active.digest)
  expect((await status(request)).requested).toEqual({ id: 'does-not-exist' })
  await name(request, { themeId: 'does-not-exist', themeVersion: '1.0.0', themeDigest: 'not-a-digest' })
  await expect.poll(async () => (await status(request)).error?.rule).toBe('pin')
  expect((await status(request)).active.digest).toBe(before.active.digest)
  // With no store set, a pin the image does not have is reported, not downloaded
  await name(request, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: `sha256:${'a'.repeat(64)}` })
  await expect.poll(async () => (await status(request)).error?.rule).toBe('off')
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator(`link[rel="stylesheet"][href="/_t/${before.active.digest}/theme.css"]`)).toHaveCount(1)
})

test('returns to the default theme when the settings name none', async ({ request }) => {
  await name(request, {})
  await expect.poll(async () => (await status(request)).active.id).toBe('alternates')
  expect((await status(request)).error).toBeNull()
  expect((await status(request)).requested).toBeNull()
})
