import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { JS, JS_LOOP, PLAYGROUND_ARTICLE, QUERY, openPlayground, resultOf, runButton, stopButton, trackRuntimeRequests } from './playground'

// The JavaScript playgrounds (QuickJS in the Worker, ADR 0004) in the dynamic and in the static site: e2e/playground/javascript.spec.ts and
// e2e/static/playground-javascript.spec.ts both register these. The guest is what the reader types; every attempt below must end as an
// error in the output (or as `undefined`), never on the page.

const RUN_WAIT = 45_000

/** Replaces the code of the playground `index` (what the reader would type). */
async function setCode(page: Page, index: number, code: string): Promise<void> {
  await page.evaluate(({ index: at, code: text }) => {
    document.querySelectorAll('micelio-playground')[at]!.querySelector('[data-playground-code]')!.textContent = text
  }, { index, code })
}

async function runCode(page: Page, code: string): Promise<'done' | 'error'> {
  await setCode(page, JS, code)
  await runButton(page, JS).click()
  const result = resultOf(page, JS)
  await expect(result).toHaveAttribute('data-state', /^(done|error)$/, { timeout: RUN_WAIT })
  return (await result.getAttribute('data-state')) as 'done' | 'error'
}

/** The Workers the page starts, one entry each: a replaced Worker shows up as a new one. */
function trackWorkers(page: Page): string[] {
  const started: string[] = []
  page.on('worker', worker => started.push(worker.url()))
  return started
}

export function registerJavascriptTests(): void {
  test('the Run label of each runtime carries its own download size, for Save-Data', async ({ request }) => {
    const html = await (await request.get(PLAYGROUND_ARTICLE)).text()
    // Every <micelio-playground> carries the label of its runtime: SQLite is the bigger download
    const sizes = [...html.matchAll(/<micelio-playground[^>]*data-save-data-label="Ejecutar \(descarga de ([\d.]+) (KB|MB)\)"[^>]*>.*?data-runtime="(\w+)"/gs)]
      .map(([, size, unit, runtime]) => [runtime, Number(size) * (unit === 'MB' ? 1024 : 1)] as const)
    const kb = Object.fromEntries(sizes)
    expect(kb.javascript).toBeGreaterThan(150)
    expect(kb.javascript).toBeLessThan(260)
    expect(kb.sql).toBeGreaterThan(kb.javascript!)
  })

  test('nothing of QuickJS loads until Run is pressed; then the code and its hidden setup run', async ({ page }) => {
    const loaded = trackRuntimeRequests(page)
    await openPlayground(page)
    await page.waitForLoadState('networkidle')
    expect(loaded).toEqual([])
    await runButton(page, JS).click()
    await expect(resultOf(page, JS)).toHaveAttribute('data-state', 'done', { timeout: RUN_WAIT })
    const expected = await page.locator('micelio-playground').nth(JS).locator('.bd-playground-output').textContent()
    expect(await resultOf(page, JS).textContent()).toBe(expected)
    expect(loaded.some(path => path.startsWith('/_islands/runtimes/javascript-'))).toBe(true)
    expect(loaded.some(path => path.endsWith('.wasm'))).toBe(true)
    // SQLite is another runtime: it stays on the server
    expect(loaded.some(path => path.includes('sqlite3') || path.includes('/sql-'))).toBe(false)
  })

  test('the runtime downloads once, and a second run starts at once', async ({ page }) => {
    const loaded = trackRuntimeRequests(page)
    await openPlayground(page)
    await runButton(page, JS).click()
    await expect(resultOf(page, JS)).toHaveAttribute('data-state', 'done', { timeout: RUN_WAIT })
    const first = [...loaded]
    expect(first.filter(path => path.endsWith('.wasm'))).toHaveLength(1)
    expect(await runCode(page, '[1, 2, 3].map(n => n * 2)')).toBe('done')
    expect(await resultOf(page, JS).textContent()).toBe('[\n  2,\n  4,\n  6\n]')
    expect(loaded).toEqual(first)
  })

  test('console output, the last value and thrown errors reach the output as text', async ({ page }) => {
    await openPlayground(page)
    expect(await runCode(page, 'console.log("<img src=x onerror=window.__xss=1>"); console.warn("careful"); console.error({ a: 1 }); "last"')).toBe('done')
    const text = (await resultOf(page, JS).textContent()) ?? ''
    expect(text).toBe('<img src=x onerror=window.__xss=1>\nwarn: careful\nerror: {\n  "a": 1\n}\nlast')
    expect(await resultOf(page, JS).locator('img').count()).toBe(0)
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()

    expect(await runCode(page, 'console.log("before"); throw new RangeError("too far")')).toBe('error')
    await expect(resultOf(page, JS)).toContainText('before')
    await expect(resultOf(page, JS)).toContainText('RangeError: too far')
    expect(await runCode(page, 'syntax error here')).toBe('error')
    await expect(resultOf(page, JS)).toContainText('SyntaxError')
  })

  test('an infinite loop is stopped inside QuickJS before the 5 s timeout, without freezing the page, and the next run works', async ({ page }) => {
    const workers = trackWorkers(page)
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
    await runButton(page, JS_LOOP).click()
    await expect(stopButton(page, JS_LOOP)).toBeVisible()
    await expect(resultOf(page, JS_LOOP)).toHaveAttribute('data-state', 'running', { timeout: RUN_WAIT })
    const started = Date.now()
    expect(await page.evaluate(() => 6 * 7)).toBe(42)
    await expect(resultOf(page, JS_LOOP)).toHaveAttribute('data-state', 'error', { timeout: 15_000 })
    const elapsed = Date.now() - started
    expect(elapsed).toBeGreaterThan(3000)
    expect(elapsed).toBeLessThan(5900)
    // The interpreter's own message, not the Worker's timeout
    await expect(resultOf(page, JS_LOOP)).toContainText('Interrupted')
    expect(await page.evaluate(() => (window as unknown as { __longestGap: number }).__longestGap)).toBeLessThan(1000)
    await expect(stopButton(page, JS_LOOP)).toBeHidden()
    await expect(runButton(page, JS_LOOP)).toHaveAttribute('aria-disabled', 'false')
    // An interrupted run replaces its Worker (the runtime comes back from the HTTP cache) and the next run works
    const workersBefore = workers.length
    expect(await runCode(page, '1 + 1')).toBe('done')
    expect(workers.length).toBe(workersBefore + 1)
  })

  test('Stop ends a JavaScript run at once, from the keyboard', async ({ page }) => {
    await openPlayground(page)
    await runButton(page, JS_LOOP).click()
    await expect(resultOf(page, JS_LOOP)).toHaveAttribute('data-state', 'running', { timeout: RUN_WAIT })
    await stopButton(page, JS_LOOP).focus()
    await page.keyboard.press('Enter')
    await expect(resultOf(page, JS_LOOP)).toHaveAttribute('data-state', 'stopped')
    await expect(runButton(page, JS_LOOP)).toBeFocused()
    // A new Worker takes its place
    expect(await runCode(page, '6 * 7')).toBe('done')
    await expect(resultOf(page, JS)).toHaveText('42')
  })

  test('a loop that only logs is cut at 64 KB', async ({ page }) => {
    await openPlayground(page)
    expect(await runCode(page, 'while (true) console.log("x".repeat(200))')).toBe('done')
    const text = (await resultOf(page, JS).textContent()) ?? ''
    expect(Buffer.byteLength(text)).toBeGreaterThan(60 * 1024)
    expect(Buffer.byteLength(text)).toBeLessThan(64 * 1024 + 120)
    expect(text).toContain('Salida cortada')
  })

  test.describe('the guest has no way out', () => {
    // Each snippet either fails with an error or finds the capability absent; none makes a request, and the page lives on
    const attempts: ReadonlyArray<{ name: string, code: string, state: 'done' | 'error', output: RegExp }> = [
      { name: 'fetch is absent', code: 'typeof fetch', state: 'done', output: /^undefined$/ },
      { name: 'fetch fails', code: 'fetch("/api/posts")', state: 'error', output: /ReferenceError/ },
      { name: 'XMLHttpRequest and WebSocket fail', code: 'new XMLHttpRequest()', state: 'error', output: /ReferenceError/ },
      { name: 'the Worker globals are not there', code: 'JSON.stringify([typeof self, typeof postMessage, typeof importScripts, typeof navigator, typeof document, typeof window, typeof WebAssembly, typeof setTimeout, typeof require, typeof process])', state: 'done', output: /^\["undefined"(?:,"undefined"){9}\]$/ },
      { name: 'globalThis holds only the language', code: 'Object.getOwnPropertyNames(globalThis).filter(name => /fetch|post|self|worker|location|storage|indexedDB|caches/i.test(name)).length', state: 'done', output: /^0$/ },
      { name: 'the Function constructor does not give the real global object', code: 'this.constructor.constructor("return this")()', state: 'error', output: /Code generation from strings is disabled/ },
      { name: 'a function\'s constructor is closed too', code: '(function () {}).constructor("return fetch")()', state: 'error', output: /Code generation from strings is disabled/ },
      { name: 'dynamic import() fails', code: 'import("/_islands/runtimes/javascript.js")', state: 'error', output: /./ },
      { name: 'eval fails', code: 'eval("1 + 1")', state: 'error', output: /Code generation from strings is disabled/ },
      { name: 'indirect eval fails', code: '(0, eval)("globalThis")', state: 'error', output: /Code generation from strings is disabled/ },
      { name: 'a memory bomb ends with out of memory', code: 'const hold = []; while (true) hold.push(new Array(1e6).fill(1))', state: 'error', output: /out of memory/ },
      { name: 'a string bomb ends with an error', code: 'let s = "x"; while (true) s += s', state: 'error', output: /./ },
      { name: 'runaway recursion ends with a stack error', code: 'function f() { return f() + 1 } f()', state: 'error', output: /stack overflow|call stack/i },
    ]

    for (const attempt of attempts) {
      test(attempt.name, async ({ page }) => {
        // What the guest tries to reach: the API route its fetch names, and any other origin
        const stray: string[] = []
        page.context().on('request', (request) => {
          const url = new URL(request.url())
          if (url.pathname === '/api/posts' || url.hostname !== '127.0.0.1') stray.push(request.url())
        })
        await openPlayground(page)
        expect(await runCode(page, attempt.code)).toBe(attempt.state)
        expect(await resultOf(page, JS).textContent()).toMatch(attempt.output)
        // Nothing the guest did reached the network
        expect(stray).toEqual([])
        // The page answers, and the same playground runs the next snippet
        expect(await page.evaluate(() => 6 * 7)).toBe(42)
        expect(await runCode(page, '"alive"')).toBe('done')
        await expect(resultOf(page, JS)).toHaveText('alive')
      })
    }

    test('after a memory bomb the Worker is replaced and the next run works', async ({ page }) => {
      const started = trackWorkers(page)
      await openPlayground(page)
      expect(await runCode(page, 'const hold = []; while (true) hold.push(new Array(1e6).fill(1))')).toBe('error')
      await expect(resultOf(page, JS)).toContainText('out of memory')
      const workersBefore = started.length
      expect(await runCode(page, '6 * 7')).toBe('done')
      await expect(resultOf(page, JS)).toHaveText('42')
      expect(started.length).toBe(workersBefore + 1)
    })

    test('a bomb in one playground leaves the SQL one working', async ({ page }) => {
      await openPlayground(page)
      expect(await runCode(page, 'const hold = []; while (true) hold.push(new Array(1e6).fill(1))')).toBe('error')
      // From the keyboard: the page scrolls back up while images above settle, and a click can land where the button was
      await runButton(page, QUERY).focus()
      await page.keyboard.press('Enter')
      await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done', { timeout: RUN_WAIT })
    })
  })

  test('a run adds no CSP violation on the page or in the Worker', async ({ page }) => {
    const messages: string[] = []
    page.on('console', message => message.text().includes('Content Security Policy') && messages.push(message.text()))
    await page.addInitScript(() => {
      const found: string[] = []
      ;(window as unknown as { __violations: string[] }).__violations = found
      document.addEventListener('securitypolicyviolation', event => found.push(`${event.violatedDirective} ${event.blockedURI}`))
    })
    await openPlayground(page, PLAYGROUND_ARTICLE)
    const violations = (): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __violations: string[] }).__violations])
    const before = await violations()
    const consoleBefore = messages.length
    expect(await runCode(page, 'console.log(1)')).toBe('done')
    // Even an attempt at the network does not break the policy: the function is gone
    expect(await runCode(page, 'try { fetch("/api/posts") } catch (error) { console.log(error.name) }')).toBe('done')
    expect(await violations()).toEqual(before)
    expect(messages.slice(consoleBefore)).toEqual([])
  })
}
