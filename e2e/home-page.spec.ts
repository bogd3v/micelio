import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

// Run by playwright.home-page.config.ts: the mock's site-setting sets the showcase page as the home page of each locale

const ORIGIN = 'https://bogdev.com.co'

// How many stylesheets (linked or inline) of a page hold the section rules
async function sectionStylesheets(request: APIRequestContext, path: string): Promise<number> {
  const html = await (await request.get(path)).text()
  const hrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match => match[1]!)
  let count = [...html.matchAll(/<style[^>]*>([^]*?)<\/style>/g)].filter(match => match[1]!.includes('bd-section-logo-track')).length
  for (const href of hrefs) {
    if ((await (await request.get(href)).text()).includes('bd-section-logo-track')) count++
  }
  return count
}

test('the browser does not ask for the other language\'s site settings', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/', { waitUntil: 'networkidle' })
  expect(requests.filter(url => url.includes('/api/site'))).toEqual([])
})

test('loads exactly one stylesheet (linked or inline) with the section rules at / and /showcase, none at /blog', async ({ request }) => {
  expect(await sectionStylesheets(request, '/')).toBe(1)
  expect(await sectionStylesheets(request, '/es')).toBe(1)
  expect(await sectionStylesheets(request, '/showcase')).toBe(1)
  expect(await sectionStylesheets(request, '/blog')).toBe(0)
})

test('/ renders the page\'s sections with one h1, its SEO and a canonical to /', async ({ page, request }) => {
  const response = await page.goto('/', { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-section]')).toHaveCount(14)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.locator('[data-section="hero"] h1')).toHaveCount(1)

  const html = await (await request.get('/')).text()
  expect(html).toContain('<title>Field Notes</title>')
  expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/">`)
  expect(html).toContain(`<link rel="alternate" hreflang="en" href="${ORIGIN}/">`)
  expect(html).toContain(`<link rel="alternate" hreflang="es" href="${ORIGIN}/es">`)
})

test('/es renders the Spanish page with a canonical to /es', async ({ page, request }) => {
  await page.goto('/es', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-section]')).toHaveCount(14)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  const html = await (await request.get('/es')).text()
  expect(html).toContain('<title>Notas de campo</title>')
  expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/es">`)
  expect(html).toContain(`<link rel="alternate" hreflang="en" href="${ORIGIN}/">`)
})

test('the page keeps answering at its slug, with a canonical to / and no redirect', async ({ request }) => {
  const response = await request.get('/showcase', { maxRedirects: 0 })
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('data-section="hero"')
  expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/">`)
  expect(html).toContain(`<link rel="alternate" hreflang="es" href="${ORIGIN}/es">`)
  const es = await (await request.get('/es/muestra', { maxRedirects: 0 })).text()
  expect(es).toContain(`<link rel="canonical" href="${ORIGIN}/es">`)
})

test('the blog and the other pages are not affected', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const response = await page.goto('/many-lists', { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
})
