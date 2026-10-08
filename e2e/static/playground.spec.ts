import { test, expect } from '@playwright/test'
import { BIG, LOOP, PLAYGROUND_ARTICLE, QUERY, openPlayground, probeWorker, resultOf, runButton, stopButton, trackRuntimeRequests, workerUrl } from '../fixtures/playground'
import type { ProbeReport } from '../fixtures/playground'

// The playground in a static build (ADR 0004, worker containment; ADR 0006, sections 6 and 7): no Vue, one policy in `_headers` and the meta,
// and a rule of its own for the Worker. `STATIC_BROWSERS=chromium,firefox,webkit` runs it on every browser (playwright.static.config.ts).

test('runs the code with no Vue on the page, and nothing of the runtime loads before Run', async ({ page }) => {
  const loaded = trackRuntimeRequests(page)
  await openPlayground(page)
  await page.waitForLoadState('networkidle')
  expect(await page.locator('#__NUXT_DATA__').count()).toBe(0)
  expect(loaded).toEqual([])
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done', { timeout: 45_000 })
  const expected = await page.locator('micelio-playground').nth(QUERY).locator('.bd-playground-output').textContent()
  expect(await resultOf(page, QUERY).textContent()).toBe(expected)
  expect(loaded.some(path => path.startsWith('/_islands/playground-'))).toBe(true)
  expect(loaded.some(path => path.endsWith('.wasm'))).toBe(true)
})

test('an infinite loop is stopped after 5 seconds without freezing the page, and Stop ends one at once', async ({ page }) => {
  await openPlayground(page)
  await runButton(page, LOOP).click()
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'running', { timeout: 45_000 })
  const started = Date.now()
  expect(await page.evaluate(() => 6 * 7)).toBe(42)
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'error', { timeout: 15_000 })
  expect(Date.now() - started).toBeGreaterThan(4000)
  expect(Date.now() - started).toBeLessThan(9000)

  await runButton(page, LOOP).click()
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'running', { timeout: 45_000 })
  await stopButton(page, LOOP).focus()
  await page.keyboard.press('Enter')
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'stopped')
})

test('caps the output at 64 KB', async ({ page }) => {
  await openPlayground(page)
  await runButton(page, BIG).click()
  await expect(resultOf(page, BIG)).toHaveAttribute('data-state', 'done', { timeout: 45_000 })
  const text = (await resultOf(page, BIG).textContent()) ?? ''
  expect(Buffer.byteLength(text)).toBeGreaterThan(60 * 1024)
  expect(Buffer.byteLength(text)).toBeLessThan(64 * 1024 + 120)
})

test('a run adds no CSP violation', async ({ page }) => {
  await page.addInitScript(() => {
    const found: string[] = []
    ;(window as unknown as { __violations: string[] }).__violations = found
    document.addEventListener('securitypolicyviolation', event => found.push(`${event.violatedDirective} ${event.blockedURI}`))
  })
  const messages: string[] = []
  page.on('console', message => message.text().includes('Content Security Policy') && messages.push(message.text()))
  await openPlayground(page)
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done', { timeout: 45_000 })
  expect(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)).toEqual([])
  expect(messages).toEqual([])
})

test.describe('CSP', () => {
  test('one policy for every page, with worker-src and wasm-unsafe-eval, in the header and the meta', async ({ request }) => {
    for (const path of [PLAYGROUND_ARTICLE, '/', '/blog']) {
      const response = await request.get(path)
      const header = response.headers()['content-security-policy'] ?? ''
      const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(await response.text())?.[1] ?? ''
      expect(header, path).toContain('worker-src \'self\'')
      expect(header, path).toMatch(/script-src 'self' 'wasm-unsafe-eval' 'sha256-/)
      expect(meta, path).toContain('worker-src \'self\'')
      expect(header.replace('frame-ancestors \'none\'; ', ''), path).toBe(meta)
    }
  })

  test('the Worker script has its own policy on top of the site one', async ({ request, baseURL }) => {
    const response = await request.get(await workerUrl(request))
    expect(response.status()).toBe(200)
    expect(response.headers()['content-security-policy']).toContain(`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src ${baseURL}/_islands/runtimes/`)
    expect(response.headers()['content-type']).toContain('javascript')
  })

  test('the browser enforces the Worker policy from its own response', async ({ page, request }) => {
    await openPlayground(page)
    const report: ProbeReport = await probeWorker(page, await workerUrl(request))
    expect(report).toEqual({
      runtimes: 'allowed',
      sameOriginElsewhere: 'blocked',
      otherOrigin: 'blocked',
      evalCode: 'blocked',
      newFunction: 'blocked',
      webAssembly: 'allowed',
    })
  })
})
