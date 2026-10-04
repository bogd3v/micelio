import { test, expect } from '@playwright/test'

test('serves self-hosted fonts without calling Google Fonts', async ({ page }) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) external.push(request.url())
  })
  const fontResponses: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('/fonts/') && response.ok()) fontResponses.push(new URL(response.url()).pathname)
  })

  await page.goto('/', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)

  expect(external).toEqual([])
  expect(fontResponses).toContain('/fonts/archivo-latin-var.woff2')
  expect(fontResponses).toContain('/fonts/jetbrains-mono-latin-var.woff2')
  const loaded = await page.evaluate(async () => ({
    archivo: (await document.fonts.load('16px Archivo', 'Bogotá')).length,
    mono: (await document.fonts.load('16px "JetBrains Mono"', 'ollama')).length,
    symbols: (await document.fonts.load('16px Archivo', '◆ ▲ ✓ ⌘')).length,
  }))
  expect(loaded.archivo).toBeGreaterThan(0)
  expect(loaded.mono).toBeGreaterThan(0)
  expect(loaded.symbols).toBeGreaterThan(0)
  const families = await page.evaluate(() => [...new Set([...document.fonts].map(f => f.family))].sort())
  expect(families).toEqual(['Archivo', 'Archivo Fallback', 'JetBrains Mono', 'JetBrains Mono Fallback'])
})

test('renders the Archivo width axis', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const widths = await page.evaluate(async () => {
    await document.fonts.load('600 16px Archivo')
    const measure = (stretch: string): number => {
      const span = document.createElement('span')
      span.textContent = 'Soberanía digital'
      span.style.cssText = `font: 600 32px Archivo; font-stretch: ${stretch}; position: absolute; white-space: nowrap`
      document.body.append(span)
      const width = span.getBoundingClientRect().width
      span.remove()
      return width
    }
    return { normal: measure('100%'), wide: measure('125%') }
  })
  expect(widths.wide).toBeGreaterThan(widths.normal * 1.1)
})

test('preloads both fonts', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toMatch(/<link[^>]+rel="preload"[^>]+href="\/fonts\/archivo-latin-var\.woff2"/)
  expect(html).toMatch(/<link[^>]+rel="preload"[^>]+href="\/fonts\/jetbrains-mono-latin-var\.woff2"/)
})
