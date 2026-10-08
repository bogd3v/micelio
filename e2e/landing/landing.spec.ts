import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { inlineScripts } from '../../app/helpers/securityHeaders'

// #244, PR 8: the landing profile (ADR 0006, section 1) built against the mock with a home page and no articles.
// The home page is the showcase page of e2e/fixtures/pages.mjs, in its version without links to the blog.
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'home (es)', path: '/es' },
  { name: 'section page', path: '/showcase' },
  { name: 'privacy', path: '/privacy' },
]

// The search island, and the loader of the heavy islands (the scene of the showcase page)
const ISLAND = /^\/_islands\/(?:search|loader)-[\w-]+\.js$/
const BLOG_OR_FEED = /\/blog(?:[/?#]|$)|\/feed(?:\.xml|\/)/

// Titled sections of the fixture, in page order: the post list has no posts and the newsletter module is off, so neither has an anchor
const SECTION_TITLES = ['What you need', 'A balcony in spring', 'One small garden', 'Friends of the garden', 'What neighbors say', 'Seed boxes', 'Questions', 'Start this weekend', 'Through the year', 'A scene']

async function hrefsOf(page: Page): Promise<string[]> {
  return page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href') ?? ''))
}

test('the home page renders the sections of the page set as home', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grow food where you live')
  expect(await page.locator('main [data-section]').count()).toBeGreaterThan(10)
  await expect(page.locator('main [data-section="post-list"]')).toHaveCount(0)
  await page.goto('/es')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cultiva comida donde vives')
})

test('the header, the footer and the menu link to the sections by id', async ({ page }) => {
  await page.goto('/')
  const ids = await page.locator('main [id^="section-"]').evaluateAll(sections => sections.map(section => section.id))
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).toHaveLength(SECTION_TITLES.length)

  const footer = page.getByRole('navigation', { name: 'Navigate' })
  const anchors = await footer.locator('a[href^="/#section-"]').evaluateAll(links => links.map(link => ({ href: link.getAttribute('href') ?? '', text: link.textContent?.trim() ?? '' })))
  expect(anchors.map(anchor => anchor.text)).toEqual(SECTION_TITLES)
  for (const { href } of anchors) expect(ids, href).toContain(href.replace('/#', ''))
  // Anchors are not "the current page"
  expect(await page.locator('a[href^="/#section-"][aria-current]').count()).toBe(0)

  // The header has room for a few: the first anchors, then the links of the hero and the call to action
  const header = page.getByRole('navigation', { name: 'Main' })
  const labels = await header.locator('a').allTextContents()
  expect(labels.map(label => label.trim())).toEqual([...SECTION_TITLES.slice(0, 4), 'Read the notes', 'Micelio'])
  expect(await header.locator('a[href="/privacy"]').count()).toBe(1)
  expect(await header.locator('a[href="https://github.com/bogd3v/micelio"]').count()).toBe(1)
  // No about page and no blog in the navigation
  expect(await header.getByText(/^(Blog|About)$/).count()).toBe(0)
})

test('the navigation of the Spanish home links to its own sections', async ({ page }) => {
  await page.goto('/es')
  const ids = await page.locator('main [id^="section-"]').evaluateAll(sections => sections.map(section => section.id))
  expect(ids.length).toBeGreaterThan(5)
  const hrefs = await page.getByRole('navigation', { name: 'Navegar' }).locator('a[href^="/es#section-"]').evaluateAll(links => links.map(link => link.getAttribute('href') ?? ''))
  expect(hrefs.length).toBe(ids.length)
  for (const href of hrefs) expect(ids, href).toContain(href.replace('/es#', ''))
})

test('an anchor of the navigation scrolls to its section without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'One small garden' }).click()
  await expect(page).toHaveURL(/\/#section-one-small-garden$/)
  await expect(page.locator('#section-one-small-garden')).toBeInViewport()
  // The footer navigation has them all
  await page.getByRole('navigation', { name: 'Navigate' }).getByRole('link', { name: 'Questions' }).click()
  await expect(page.locator('#section-questions')).toBeInViewport()
  // From another page the same link goes to the home page's section
  await page.goto('/privacy')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'What you need' }).click()
  await expect(page).toHaveURL(/\/#section-what-you-need$/)
  await context.close()
})

for (const { name, path } of PAGES) {
  test(`${name} links nowhere to the blog or the feeds`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    const links = [...html.matchAll(/<(?:a|link)\b[^>]*\shref="([^"]*)"/g)].map(match => match[1]!)
    expect(links.filter(href => BLOG_OR_FEED.test(href))).toEqual([])
    expect(html).not.toMatch(/application\/rss\+xml/)
    // The search without JS goes to the navigation, not to a blog list
    expect(html).toContain('data-micelio-search-open')
    expect(html).not.toMatch(/href="[^"]*\/blog[^"]*" data-micelio-search-open/)
  })

  test(`${name} loads no Nuxt client, payload, API call or blog request`, async ({ page, baseURL }) => {
    const urls: string[] = []
    page.on('request', request => urls.push(request.url()))
    expect((await page.goto(path, { waitUntil: 'networkidle' }))?.status()).toBe(200)
    expect(urls.filter(url => /\/_nuxt\/[^?]*\.m?js/.test(url))).toEqual([])
    expect(urls.filter(url => url.includes('_payload'))).toEqual([])
    expect(urls.filter(url => new URL(url).pathname.startsWith('/api/'))).toEqual([])
    expect(urls.filter(url => BLOG_OR_FEED.test(new URL(url).pathname))).toEqual([])
    expect(urls.filter(url => !url.startsWith(baseURL!) && !url.startsWith('data:'))).toEqual([])
  })

  test(`${name} has no Nuxt state in the HTML and the CSP covers its inline script`, async ({ request }) => {
    const response = await request.get(path)
    const html = await response.text()
    expect([...html.matchAll(/<script[^>]*\ssrc="([^"]*)"/g)].map(match => match[1]).filter(src => !ISLAND.test(src!))).toEqual([])
    expect(html).not.toContain('__NUXT__')
    expect(html).not.toContain('__NUXT_DATA__')
    expect(html).not.toContain('_payload.json')
    const policy = response.headers()['content-security-policy'] ?? ''
    expect(policy).toContain('default-src \'self\'')
    for (const script of inlineScripts(html)) expect(policy).toContain(`'sha256-${createHash('sha256').update(script).digest('base64')}'`)
  })
}

test('there is no blog, category, tag page, feed or about page in the output', async ({ request }) => {
  for (const path of ['/blog', '/es/blog', '/blog/page/2', '/blog/category/linux', '/blog/tag/vue', '/blog/understanding-vue-composables', '/feed.xml', '/es/feed.xml', '/feed/linux.xml', '/es/feed/linux.xml', '/about', '/es/about']) {
    expect((await request.get(path)).status(), path).toBe(404)
  }
})

test('the sitemap lists no blog URL and robots.txt points at it', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  const locations = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => new URL(match[1]!).pathname)
  expect(locations).toEqual(expect.arrayContaining(['/', '/es', '/privacy']))
  expect(locations.filter(path => BLOG_OR_FEED.test(path))).toEqual([])
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:')
})

test('the 404 page does not offer the blog', async ({ page }) => {
  const response = await page.goto('/blog')
  expect(response?.status()).toBe(404)
  expect((await hrefsOf(page)).filter(href => BLOG_OR_FEED.test(href))).toEqual([])
})

test('search finds the sections of the home page and loads nothing of the blog', async ({ page }) => {
  const paths: string[] = []
  page.on('request', request => paths.push(new URL(request.url()).pathname))
  await page.goto('/', { waitUntil: 'networkidle' })
  // The island turns the link into the button that opens the palette
  await expect(page.locator('a[data-micelio-search-open]')).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: 'Search BogDev' })
  await expect(palette).toBeVisible()
  await palette.getByRole('combobox').fill('balcony')
  await expect(palette.getByRole('option').first()).toBeVisible()
  await expect(palette.getByRole('option').first().locator('mark').first()).toBeVisible()
  expect(paths.filter(path => BLOG_OR_FEED.test(path))).toEqual([])
})

test('the home page carries one speculationrules script, hashed in the CSP meta', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const scripts = [...html.matchAll(/<script type="speculationrules">([\s\S]*?)<\/script>/g)].map(match => match[1]!)
  expect(scripts).toHaveLength(1)
  expect(() => JSON.parse(scripts[0]!)).not.toThrow()
  const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1] ?? ''
  expect(meta).toContain(`'sha256-${createHash('sha256').update(scripts[0]!).digest('base64')}'`)
})
