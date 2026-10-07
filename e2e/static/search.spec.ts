import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ADR 0006, sections 3 and 4: the palette is an island; Pagefind loads only when it opens
const ARTICLE = '/blog/understanding-vue-composables'
const HOME = '/'
const ISLAND = /^\/_islands\/search-[\w-]+\.js$/

function trackRequests(page: Page): string[] {
  const paths: string[] = []
  page.on('request', request => paths.push(new URL(request.url()).pathname))
  return paths
}

function trigger(page: Page): ReturnType<Page['locator']> {
  return page.locator('.bd-chip[aria-haspopup="dialog"]')
}

test('a page loads the small island and nothing of Pagefind', async ({ page }) => {
  const paths = trackRequests(page)
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  const scripts = paths.filter(path => /\.m?js$/.test(path))
  expect(scripts).toHaveLength(1)
  expect(scripts[0]).toMatch(ISLAND)
  expect(paths.filter(path => path.startsWith('/pagefind/'))).toEqual([])
  expect(await page.locator('link[rel="modulepreload"]').count()).toBe(0)
})

test('the island is only on the pages that render the search', async ({ request }) => {
  for (const path of ['/', '/es', '/blog', ARTICLE, '/showcase']) {
    const html = await (await request.get(path)).text()
    const sources = [...html.matchAll(/<script[^>]*\ssrc="([^"]*)"/g)].map(match => match[1])
    expect(sources, path).toHaveLength(1)
    expect(sources[0], path).toMatch(ISLAND)
    expect(html, path).toContain('<micelio-search')
  }
})

test('the shortcut and the button open the palette, which loads Pagefind then', async ({ page }) => {
  const paths = trackRequests(page)
  await page.goto(ARTICLE, { waitUntil: 'networkidle' })
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await expect(palette).toBeHidden()

  await page.keyboard.press('ControlOrMeta+k')
  await expect(palette).toBeVisible()
  await expect(palette.getByRole('combobox')).toBeFocused()
  await expect.poll(() => paths.some(path => path === '/pagefind/pagefind.js')).toBe(true)
  await page.keyboard.press('ControlOrMeta+k')
  await expect(palette).toBeHidden()
})

test('a query loads the Pagefind runtime, only the page language', async ({ page }) => {
  const paths = trackRequests(page)
  await page.goto(HOME, { waitUntil: 'networkidle' })
  const initial = paths.length
  await trigger(page).click()
  await page.getByRole('dialog').getByRole('combobox').fill('vue')
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  const loaded = (): string[] => paths.slice(initial).filter(path => path.startsWith('/pagefind/'))
  await expect.poll(loaded).toEqual(expect.arrayContaining(['/pagefind/pagefind.js', '/pagefind/pagefind-entry.json', '/pagefind/wasm.en.pagefind']))
  expect(loaded().filter(path => /\.(es|unknown)[._]|\/es_/.test(path))).toEqual([])
})

// Sizes of what the search sends (docs/performance.md, "Islands"): gzipped like a CDN would, level 9 like the build
const gzipKb = (file: string): number => gzipSync(readFileSync(file), { level: 9 }).length / 1024
const site = join(process.cwd(), '.output/public')

test('the search island and Pagefind stay within the islands budget', () => {
  const budget = JSON.parse(readFileSync(join(process.cwd(), 'scripts/perf/budgets.json'), 'utf8')).islands.search.error as Record<string, number>
  const [island] = readdirSync(join(site, '_islands')).filter(name => /^search-[\w-]+\.js$/.test(name))
  expect(island).toBeDefined()
  const loaderGzKb = gzipKb(join(site, '_islands', island!))
  const pagefindGzKb = gzipKb(join(site, 'pagefind/pagefind.js')) + gzipKb(join(site, 'pagefind/pagefind-worker.js'))
  const wasmKb = Math.max(...readdirSync(join(site, 'pagefind')).filter(name => /^wasm\.[a-z]+\.pagefind$/.test(name)).map(name => statSync(join(site, 'pagefind', name)).size / 1024))
  expect(loaderGzKb).toBeLessThanOrEqual(budget.loaderGzKb!)
  expect(pagefindGzKb).toBeLessThanOrEqual(budget.pagefindGzKb!)
  expect(wasmKb).toBeLessThanOrEqual(budget.wasmKb!)
})

test('the header button is a real button with a popup', async ({ page }) => {
  await page.goto(HOME, { waitUntil: 'networkidle' })
  const button = trigger(page)
  await expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(button).not.toHaveAttribute('href', /.*/)
  await button.click()
  await expect(page.getByRole('dialog', { name: 'Search BogDev' })).toBeVisible()
})

test('searches the English index, navigates with the keyboard and closes with Escape', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await trigger(page).click()
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  const input = palette.getByRole('combobox')
  await input.fill('vue')

  const options = palette.getByRole('option')
  await expect(options.first()).toBeVisible()
  // Best match first: the article, then the pages that mention it
  await expect(options.first()).toContainText('Understanding Vue Composables')
  await expect(options.first()).toContainText('Article')
  await expect(options.first().locator('mark').first()).toBeVisible()
  await expect(palette.getByRole('status')).toHaveText(/^\d+ results?$/)
  await expect(palette).not.toContainText('Guía')

  await page.keyboard.press('ArrowDown')
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await expect(input).toHaveAttribute('aria-activedescendant', await options.first().getAttribute('id') ?? '')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`${ARTICLE}$`))
})

test('on /blog the trigger is not announced as the current page', async ({ page }) => {
  const html = await (await page.request.get('/blog')).text()
  expect(html.match(/<a[^>]*data-micelio-search-open[^>]*>/g)?.join(' ')).not.toMatch(/aria-current|router-link/)
  await page.goto('/blog', { waitUntil: 'networkidle' })
  for (const button of await page.locator('button[aria-haspopup="dialog"]').all()) {
    await expect(button).not.toHaveAttribute('aria-current', /.*/)
    expect(await button.getAttribute('class')).not.toContain('router-link')
  }
})

test('says the search is unavailable when Pagefind cannot load, and recovers its state', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', route => route.abort())
  await page.goto(HOME, { waitUntil: 'networkidle' })
  await trigger(page).click()
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  const input = palette.getByRole('combobox')
  await input.fill('vue')
  await expect(palette).toContainText('Search is unavailable right now')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(input).not.toHaveAttribute('aria-activedescendant', /.*/)
  await expect(palette.getByRole('option')).toHaveCount(0)
})

test('closing returns the focus to the trigger and clears the query', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const button = trigger(page)
  await button.click()
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await palette.getByRole('combobox').fill('vue')
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
  await expect(button).toBeFocused()
  await button.click()
  await expect(palette.getByRole('combobox')).toHaveValue('')
})

test('the Spanish pages search the Spanish index only', async ({ page }) => {
  await page.goto('/es', { waitUntil: 'networkidle' })
  await trigger(page).click()
  const palette = page.getByRole('dialog', { name: 'Buscar en BogDev' })
  const input = palette.getByRole('combobox')

  await input.fill('huerta')
  const options = palette.getByRole('option')
  await expect(options.first()).toContainText('huerta')
  await expect(options.first()).toContainText('Página')

  await input.fill('composables')
  await expect(options).toHaveCount(1)
  await expect(options.first()).toContainText('Guía de Vue Composables')
  expect(await options.first().getAttribute('href')).toBe('/es/blog/guia-vue-composables')

  // English-only words find nothing here
  await input.fill('hardening')
  await expect(palette.getByText('Sin resultados para «hardening»').first()).toBeVisible()
})

test('shows the empty state and the short-query note', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await trigger(page).click()
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await expect(palette).toContainText('Type 3 or more letters')
  await palette.getByRole('combobox').fill('zzzzqq')
  await expect(palette).toContainText('No results for “zzzzqq”')
})

test('the open palette has no CSP violation and no axe violation', async ({ page }) => {
  const violations: string[] = []
  await page.addInitScript(() => {
    ;(window as unknown as { __violations: string[] }).__violations = []
    document.addEventListener('securitypolicyviolation', event => (window as unknown as { __violations: string[] }).__violations.push(`${event.violatedDirective} ${event.blockedURI}`))
  })
  page.on('console', message => message.text().includes('Content Security Policy') && violations.push(message.text()))
  await page.goto(HOME, { waitUntil: 'networkidle' })
  await trigger(page).click()
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await palette.getByRole('combobox').fill('vue')
  await expect(palette.getByRole('option').first()).toBeVisible()

  const results = await new AxeBuilder({ page }).include('micelio-search').analyze()
  expect(results.violations.map(violation => violation.id)).toEqual([])
  expect(violations).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)).toEqual([])
})

test('without JavaScript the search is a link to the blog list', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/es/blog/guia-vue-composables')
  const link = page.locator('a[data-micelio-search-open]').first()
  expect(await link.getAttribute('href')).toBe('/es/blog')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('button:visible')).toHaveCount(0)
  await context.close()
})
