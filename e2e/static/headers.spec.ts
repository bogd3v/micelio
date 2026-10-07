import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { SECURITY_HEADERS, inlineScripts } from '../../app/helpers/securityHeaders'

// ADR 0006, section 7: one policy for /* from the hashes collected at build, in `_headers` and in a meta
const PAGES = [
  { name: 'home', path: '/', status: 200 },
  { name: 'home (es)', path: '/es', status: 200 },
  { name: 'article', path: '/blog/understanding-vue-composables', status: 200 },
  { name: 'section page', path: '/showcase', status: 200 },
  { name: '404', path: '/blog/does-not-exist', status: 404 },
]

function hashOf(script: string): string {
  return `'sha256-${createHash('sha256').update(script).digest('base64')}'`
}

for (const { name, path, status } of PAGES) {
  test(`${name}: the CSP header and the meta carry the hash of the inline script`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(status)
    const html = await response.text()
    const hashes = inlineScripts(html).map(hashOf)
    expect(hashes.length).toBeGreaterThan(0)

    const header = response.headers()['content-security-policy'] ?? ''
    const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1] ?? ''
    for (const hash of hashes) {
      expect(header).toContain(hash)
      expect(meta).toContain(hash)
    }
    expect(header).toMatch(/script-src 'self' 'sha256-[^;]+;/)
    expect(header).toContain('frame-ancestors \'none\'')
    expect(meta).not.toContain('frame-ancestors')
    // Same policy but for the directives a meta cannot carry
    expect(header.replace('frame-ancestors \'none\'; ', '')).toBe(meta)
    // No Strapi origin: images and media are copied into the site
    expect(header).toMatch(/img-src 'self' data:;/)
    expect(header).toMatch(/media-src 'self';/)
  })

  test(`${name}: has the security headers`, async ({ request }) => {
    const headers = (await request.get(path)).headers()
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) expect(headers[header], header).toBe(value)
  })

  test(`${name}: the browser reports no CSP violation`, async ({ page }) => {
    const messages: string[] = []
    page.on('console', message => message.text().includes('Content Security Policy') && messages.push(message.text()))
    await page.addInitScript(() => {
      const found: string[] = []
      ;(window as unknown as { __violations: string[] }).__violations = found
      document.addEventListener('securitypolicyviolation', event => found.push(`${event.violatedDirective} ${event.blockedURI}`))
    })
    await page.goto(path, { waitUntil: 'networkidle' })
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y)
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    })
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)).toEqual([])
    expect(messages).toEqual([])
  })
}

test('hashed assets are cached for a year, _ipx revalidates, pages are not', async ({ request }) => {
  const html = await (await request.get('/blog')).text()
  const css = /href="(\/_nuxt\/[^"]+\.css)"/.exec(html)?.[1]
  const image = /src="(\/_ipx\/[^"]+)"/.exec(html)?.[1]?.replaceAll('&amp;', '&')
  const media = /(?:src|poster)="(\/_media\/[^"]+)"/.exec(await (await request.get('/showcase')).text())?.[1]
  expect(css).toBeTruthy()
  expect(image).toBeTruthy()
  expect(media).toBeTruthy()
  for (const asset of [css!, image!, media!]) {
    const response = await request.get(asset)
    expect(response.status(), asset).toBe(200)
    const immutable = !asset.startsWith('/_ipx/')
    expect(response.headers()['cache-control'], asset).toBe(immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate')
    // Copied Strapi files carry a second, tighter policy (repeated policies only tighten)
    if (asset.startsWith('/_media/')) expect(response.headers()['content-security-policy']).toContain('default-src \'none\'; style-src \'unsafe-inline\'; img-src \'self\' data:; sandbox')
  }
  expect((await request.get('/')).headers()['cache-control']).toBeUndefined()
})

test('there is no SPA fallback: unknown paths get 404.html', async ({ request }) => {
  expect((await request.get('/200.html')).status()).toBe(404)
  const response = await request.get('/nothing/here')
  expect(response.status()).toBe(404)
  expect(await response.text()).toContain('<html')
})

test('images carry no inline error handler', async ({ request }) => {
  const html = await (await request.get('/blog')).text()
  expect(html).toContain('data-nuxt-img')
  expect(html).not.toContain('onerror=')
})
