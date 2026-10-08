import { test, expect } from '@playwright/test'
import { BIG, LOOP, PLAYGROUND_ARTICLE, PLAYGROUND_FREE_ARTICLE, QUERY, openPlayground, playground, probeWorker, resultOf, runButton, stopButton, trackRuntimeRequests, workerUrl } from '../fixtures/playground'
import type { ProbeReport } from '../fixtures/playground'

// The playground island and its Worker in the dynamic site (ADR 0004, worker containment; ADR 0006, section 6), on every browser.
// playwright.playground.config.ts runs it against the production build, the only place the policies are sent.

test('the page declares only the small loader, never the island, a Worker or a runtime', async ({ request }) => {
  const html = await (await request.get(PLAYGROUND_ARTICLE)).text()
  const files = [...html.matchAll(/(?:src|href)="([^"]*\/_islands\/[^"]*)"/g)].map(match => match[1])
  expect(files).toHaveLength(1)
  expect(files[0]).toMatch(/^\/_islands\/loader-[\w-]+\.js$/)
  expect(html).toMatch(/<script id="micelio-island-playground"[^>]*>[^<]*"src":"\/_islands\/playground-[\w-]+\.js"/)
  // A page without a playground has nothing of it
  const free = await (await request.get(PLAYGROUND_FREE_ARTICLE)).text()
  expect(free).not.toContain('micelio-playground')
  expect(free).not.toContain('micelio-island-playground')
})

test('nothing of the runtime loads until Run is pressed, then it runs the code and shows the expected output', async ({ page }) => {
  const loaded = trackRuntimeRequests(page)
  await openPlayground(page)
  await page.waitForLoadState('networkidle')
  expect(loaded).toEqual([])
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done')
  const expected = await playground(page, QUERY).locator('.bd-playground-output').textContent()
  expect(await resultOf(page, QUERY).textContent()).toBe(expected)
  expect(loaded.some(path => path.startsWith('/_islands/playground-'))).toBe(true)
  expect(loaded.some(path => path.startsWith('/_islands/workers/'))).toBe(true)
  expect(loaded.some(path => path.endsWith('.wasm'))).toBe(true)
})

test('is operated with the keyboard and announces the output in a live region', async ({ page }) => {
  await openPlayground(page)
  await expect(resultOf(page, QUERY)).not.toHaveAttribute('aria-live', /./)
  await expect(playground(page, QUERY).locator('[data-playground-status]')).toHaveAttribute('role', 'status')
  await runButton(page, QUERY).focus()
  await page.keyboard.press('Enter')
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done')
  // The button keeps the focus the reader gave it, and a short status is announced
  await expect(runButton(page, QUERY)).toBeFocused()
  await expect(playground(page, QUERY).locator('[data-playground-status]')).toHaveText(/^Terminó, \d+ líneas de salida\.$/)
})

test('the runtime downloads once for every playground of the page', async ({ page }) => {
  const loaded = trackRuntimeRequests(page)
  await openPlayground(page)
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done')
  const first = [...loaded]
  await runButton(page, BIG).click()
  await expect(resultOf(page, BIG)).toHaveAttribute('data-state', 'done')
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done')
  expect(loaded).toEqual(first)
  expect(first.filter(path => path.endsWith('.wasm'))).toHaveLength(1)
})

test('an infinite loop is stopped after 5 seconds without freezing the page', async ({ page }) => {
  await openPlayground(page)
  await page.evaluate(() => {
    const state = window as unknown as { __longestGap: number }
    state.__longestGap = 0
    let last = performance.now()
    setInterval(() => {
      const now = performance.now()
      state.__longestGap = Math.max(state.__longestGap, now - last)
      last = now
    }, 50)
  })
  await runButton(page, LOOP).click()
  await expect(stopButton(page, LOOP)).toBeVisible()
  // The clock starts when the runtime is loaded, however long that takes
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'running', { timeout: 45_000 })
  const started = Date.now()
  // The page answers while the Worker spins
  expect(await page.evaluate(() => 6 * 7)).toBe(42)
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'error', { timeout: 15_000 })
  const elapsed = Date.now() - started
  expect(elapsed).toBeGreaterThan(4000)
  expect(elapsed).toBeLessThan(9000)
  await expect(resultOf(page, LOOP)).toContainText('5')
  expect(await page.evaluate(() => (window as unknown as { __longestGap: number }).__longestGap)).toBeLessThan(1000)
  await expect(stopButton(page, LOOP)).toBeHidden()
  await expect(runButton(page, LOOP)).toHaveAttribute('aria-disabled', 'false')
  // The terminated Worker is replaced by a new one
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done')
})

test('Stop ends a run at once, from the keyboard', async ({ page }) => {
  await openPlayground(page)
  await runButton(page, LOOP).click()
  await expect(stopButton(page, LOOP)).toBeVisible()
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'running', { timeout: 45_000 })
  await stopButton(page, LOOP).focus()
  await page.keyboard.press('Enter')
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'stopped')
  await expect(stopButton(page, LOOP)).toBeHidden()
  // The focus goes back to Run instead of falling on the page
  await expect(runButton(page, LOOP)).toBeFocused()
  await expect(runButton(page, LOOP)).toHaveAttribute('aria-disabled', 'false')
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done')
})

test('a playground that waits behind another says so, and Stop on it answers at once', async ({ page }) => {
  await openPlayground(page)
  await runButton(page, LOOP).click()
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'running', { timeout: 45_000 })
  // Run, read, Stop and read again happen in one task, so the 5 s clock of the loop cannot run out between them
  const states = await page.evaluate(async ([queryIndex, loopIndex]) => {
    const blocks = [...document.querySelectorAll('micelio-playground')]
    const part = (index: number, selector: string): HTMLElement => blocks[index]!.querySelector<HTMLElement>(selector)!
    part(queryIndex!, '[data-playground-run]').click()
    const queued = part(queryIndex!, '[data-playground-result]').dataset.state
    part(queryIndex!, '[data-playground-stop]').click()
    await new Promise(resolve => setTimeout(resolve, 0))
    return { queued, stopped: part(queryIndex!, '[data-playground-result]').dataset.state, loop: part(loopIndex!, '[data-playground-result]').dataset.state }
  }, [QUERY, LOOP])
  // The run in front of it is untouched
  expect(states).toEqual({ queued: 'queued', stopped: 'stopped', loop: 'running' })
  await stopButton(page, LOOP).click()
  await expect(resultOf(page, LOOP)).toHaveAttribute('data-state', 'stopped')
})

test('a result that would need a huge allocation fails with an error and the page lives on', async ({ page }) => {
  await openPlayground(page)
  for (const sql of ['SELECT zeroblob(1000000000);', 'WITH RECURSIVE r(s) AS (SELECT \'x\' UNION ALL SELECT s || s FROM r) SELECT length(s) FROM r;']) {
    await page.evaluate((code) => {
      document.querySelectorAll('micelio-playground')[0]!.querySelector('[data-playground-code]')!.textContent = code
    }, sql)
    await runButton(page, QUERY).click()
    await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'error', { timeout: 20_000 })
    expect(await page.evaluate(() => 6 * 7)).toBe(42)
  }
  // The Worker is still good for the next run
  await page.evaluate(() => {
    document.querySelectorAll('micelio-playground')[0]!.querySelector('[data-playground-code]')!.textContent = 'SELECT 1 AS one;'
  })
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done')
})

test('the output is capped at 64 KB and written as text', async ({ page }) => {
  await openPlayground(page)
  await runButton(page, BIG).click()
  await expect(resultOf(page, BIG)).toHaveAttribute('data-state', 'done')
  const text = (await resultOf(page, BIG).textContent()) ?? ''
  // The cap plus the notice that the output was cut
  expect(Buffer.byteLength(text)).toBeGreaterThan(60 * 1024)
  expect(Buffer.byteLength(text)).toBeLessThan(64 * 1024 + 120)
  expect(text).toContain('Salida cortada')
})

test('markup and errors in the result are text, never HTML', async ({ page }) => {
  await openPlayground(page)
  await page.evaluate(() => {
    const code = document.querySelectorAll('micelio-playground')[0]!.querySelector('[data-playground-code]')!
    code.textContent = 'SELECT \'<img src=x onerror=window.__xss=1>\' AS html;'
  })
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done')
  expect(await resultOf(page, QUERY).locator('img').count()).toBe(0)
  expect(await resultOf(page, QUERY).textContent()).toContain('<img src=x onerror=window.__xss=1>')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()

  await page.evaluate(() => {
    document.querySelectorAll('micelio-playground')[0]!.querySelector('[data-playground-code]')!.textContent = 'SELEC 1;'
  })
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'error')
  await expect(resultOf(page, QUERY)).toContainText('Error:')
})

test('a run adds no CSP violation on the page or in the Worker', async ({ page }) => {
  const messages: string[] = []
  page.on('console', message => message.text().includes('Content Security Policy') && messages.push(message.text()))
  await page.addInitScript(() => {
    const found: string[] = []
    ;(window as unknown as { __violations: string[] }).__violations = found
    document.addEventListener('securitypolicyviolation', event => found.push(`${event.violatedDirective} ${event.blockedURI}`))
  })
  await openPlayground(page)
  const violations = (): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __violations: string[] }).__violations])
  // Whatever the page already reports on its own (Firefox flags NuxtImg's inline onerror in the dynamic site) is the baseline
  const before = await violations()
  const consoleBefore = messages.length
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done', { timeout: 45_000 })
  expect(await violations()).toEqual(before)
  expect(messages.slice(consoleBefore)).toEqual([])
})

test.describe('CSP', () => {
  test('a page with a playground gets worker-src, and no wasm-unsafe-eval; the others keep their policy', async ({ request }) => {
    const withPlayground = (await request.get(PLAYGROUND_ARTICLE)).headers()['content-security-policy'] ?? ''
    expect(withPlayground).toContain('worker-src \'self\'')
    expect(withPlayground).toMatch(/script-src 'self' 'sha256-/)
    expect(withPlayground).not.toContain('wasm-unsafe-eval')
    for (const path of [PLAYGROUND_FREE_ARTICLE, '/', '/blog', '/es', '/about']) {
      const policy = (await request.get(path)).headers()['content-security-policy'] ?? ''
      expect(policy, path).not.toContain('worker-src')
      expect(policy, path).not.toContain('wasm-unsafe-eval')
      expect(policy, path).toMatch(/script-src 'self' 'sha256-/)
    }
    // Everything else on the page is the same policy
    const without = (await request.get(PLAYGROUND_FREE_ARTICLE)).headers()['content-security-policy'] ?? ''
    expect(withPlayground.replace('; worker-src \'self\'', '').replace(/'sha256-[^']+'/g, '').replace(/\s+/g, ' ')).toBe(without.replace(/'sha256-[^']+'/g, '').replace(/\s+/g, ' '))
  })

  test('the Worker script has its own policy: runtimes folder only, no eval', async ({ request, baseURL }) => {
    const response = await request.get(await workerUrl(request))
    expect(response.status()).toBe(200)
    expect(response.headers()['content-security-policy']).toBe(`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src ${baseURL}/_islands/runtimes/`)
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
