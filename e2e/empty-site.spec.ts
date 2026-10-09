import { test, expect } from '@playwright/test'

// Run by playwright.empty-site.config.ts: the mock's site-setting has no value, so every page shows the app.config.ts defaults

const BOGDEV_STRINGS = ['bogdev', 'Alejandro', 'hotmail', 'ale9420', 'devbog', 'buymeacoffee']
// The head and the feed carry only site content; the body of the default theme (themes/bogota/) and the Law 1581 text name Bogotá and Colombia
const PLACE_STRINGS = ['bogot', 'colombia', 'software developer']

// Out of scope: the devbog-* storage keys of the init script (P3, #418) and the Bogotá theme's images (themes/bogota/)
const THEME_LEGACY = [/devbog-(?:theme|color-mode)/g, /\/theme\/images\/bogdev\.svg/g, /\\u002Ftheme\\u002Fimages\\u002Fbogdev\.svg/g, /bogota/gi]

const PAGES = ['/', '/about', '/privacy', '/feed.xml']

for (const path of PAGES) {
  test(`${path} carries none of BogDev's identity`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    const body = THEME_LEGACY.reduce((text, legacy) => text.replace(legacy, ''), await response.text()).toLowerCase()
    for (const text of BOGDEV_STRINGS) expect(body, text).not.toContain(text.toLowerCase())
    const head = path === '/feed.xml' ? body : (body.match(/<head>.*<\/head>/s)?.[0] ?? '')
    for (const text of PLACE_STRINGS) expect(head, text).not.toContain(text)
  })
}

test('the footer shows the neutral name without author, social links or support', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const footer = page.locator('footer.bd-foot')
  await expect(footer.locator('.bd-foot-legal span').first()).toHaveText(`© ${new Date().getFullYear()} Micelio`)
  await expect(footer.locator('a.bd-foot-soc')).toHaveCount(0)
  await expect(footer.locator('a[href*="buymeacoffee"]')).toHaveCount(0)
})

test('the privacy page has no contact link and no date', async ({ page }) => {
  await page.goto('/privacy', { waitUntil: 'networkidle' })
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)
  await expect(page.locator('.bd-privacy-updated')).toHaveText('Legal')
})

test('an article has no support section', async ({ page }) => {
  await page.goto('/blog/linux-server-hardening-guide', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-coffee')).toHaveCount(0)
  await expect(page.locator('a[href*="buymeacoffee"]')).toHaveCount(0)
})

test('the home page JSON-LD has no empty description or sameAs', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1] ?? ''
  expect(ld).not.toBe('')
  expect(ld).not.toContain('"description"')
  expect(ld).not.toContain('"sameAs"')
})

test('/about emits no Person JSON-LD without an author name', async ({ request }) => {
  const html = await (await request.get('/about')).text()
  expect(html).not.toContain('"@type":"Person"')
})

test('the home page description is the neutral fallback', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toMatch(/<meta name="description" content="Latest articles from Micelio\.">/)
})
