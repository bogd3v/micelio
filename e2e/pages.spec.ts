import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// How many stylesheets (linked or inline) of a page hold the section rules
async function sectionStylesheets(request: APIRequestContext, path: string): Promise<number> {
  const html = await (await request.get(path)).text()
  const hrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match => match[1]!)
  let count = [...html.matchAll(/<style[^>]*>([^]*?)<\/style>/g)].filter(match => match[1]!.includes('myc-section-logo-track')).length
  for (const href of hrefs) {
    if ((await (await request.get(href)).text()).includes('myc-section-logo-track')) count++
  }
  return count
}

test('section CSS is one stylesheet on a section page and absent from the home and the blog', async ({ request }) => {
  expect(await sectionStylesheets(request, '/showcase')).toBe(1)
  expect(await sectionStylesheets(request, '/')).toBe(0)
  expect(await sectionStylesheets(request, '/blog')).toBe(0)
})

const PAGES = [
  { path: '/showcase', title: 'Field Notes', description: 'A demo of every section a Micelio page can use.', canonical: 'https://bogdev.com.co/showcase', lang: 'en' },
  { path: '/es/muestra', title: 'Notas de campo', description: 'Una muestra de todas las secciones que puede usar una página de Micelio.', canonical: 'https://bogdev.com.co/es/muestra', lang: 'es' },
]

for (const entry of PAGES) {
  test(`${entry.path} renders every section with one h1 and its SEO`, async ({ page, request }) => {
    const response = await page.goto(entry.path, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)
    await expect(page.locator('[data-section]')).toHaveCount(14)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    // The hero opens the page, so its title is the h1
    await expect(page.locator('[data-section="hero"] h1')).toHaveCount(1)

    const html = await (await request.get(entry.path)).text()
    expect(html).toContain(`<title>${entry.title}</title>`)
    expect(html).toContain(`<meta name="description" content="${entry.description}">`)
    expect(html).toContain(`<link rel="canonical" href="${entry.canonical}">`)
    expect(html).toMatch(/<meta property="og:image" content="http[^"]*\/uploads\/page-og\.png">/)
    expect(html).toContain('<link rel="alternate" hreflang="en" href="https://bogdev.com.co/showcase">')
    expect(html).toContain('<link rel="alternate" hreflang="es" href="https://bogdev.com.co/es/muestra">')
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://bogdev.com.co/showcase">')
  })
}

test('the locale switcher goes to the translated slug', async ({ page }) => {
  await page.goto('/showcase', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click()
  await expect(page).toHaveURL(/\/es\/muestra$/)
})

test('an unknown page and a bad slug show the 404 page', async ({ page }) => {
  for (const path of ['/does-not-exist', '/Showcase', '/es/does-not-exist']) {
    const response = await page.goto(path, { waitUntil: 'networkidle' })
    expect(response?.status(), path).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/not found|no encontrada/i)
  }
})

test('static routes win over the catch-all', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hi, I am Alejandro.')
})

test('a page without a hero names itself with its title as the h1', async ({ page }) => {
  await page.goto('/many-lists', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Many lists')
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the FAQ opens and no video autoplays', async ({ page }) => {
    await page.goto('/showcase')
    const first = page.locator('[data-section="faq"] details').first()
    await expect(first).not.toHaveAttribute('open', '')
    await first.locator('summary').click()
    await expect(first).toHaveAttribute('open', '')
    await expect(page.locator('video[autoplay]')).toHaveCount(0)
  })
})

test('/showcase has no axe violations', async ({ page }) => {
  await page.goto('/showcase', { waitUntil: 'networkidle' })
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)
  expect(summary).toEqual([])
})
