import { test, expect } from '@playwright/test'
import { openPlayground, playground, resultOf, runButton, stopButton, trackRuntimeRequests } from '../fixtures/playground'
import { PYTHON, PYTHON_LOOP, runPython, trackApiRequests } from '../fixtures/python'

// The Python runtime (Pyodide, self-hosted) in a static build (ADR 0004, worker containment; ADR 0006, sections 6 and 7): the `.mjs`, `.wasm`
// and `.zip` files of /_islands/runtimes/ are served as they are, and the Worker policy of `_headers` is the one that lets it start.
// `STATIC_BROWSERS=chromium,firefox,webkit` runs it on every browser (playwright.static.config.ts).

const isPyodide = (path: string): boolean => /^\/_islands\/runtimes\/(?:python-|pyodide-)/.test(path)

test('nothing of Python loads before Run, then it runs the code with no Vue on the page', async ({ page }) => {
  const loaded = trackRuntimeRequests(page)
  await openPlayground(page)
  await page.waitForLoadState('networkidle')
  expect(await page.locator('#__NUXT_DATA__').count()).toBe(0)
  expect(loaded).toEqual([])
  await runButton(page, PYTHON).click()
  await expect(resultOf(page, PYTHON)).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
  const expected = await playground(page, PYTHON).locator('.myc-playground-output').textContent()
  expect(await resultOf(page, PYTHON).textContent()).toBe(expected)
  expect(loaded.filter(isPyodide).map(path => path.split('/').pop())).toEqual(expect.arrayContaining(['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']))
})

test('an infinite loop is stopped after 5 seconds, and Stop ends one at once', async ({ page }) => {
  test.setTimeout(90_000)
  await openPlayground(page)
  await runButton(page, PYTHON_LOOP).click()
  await expect(resultOf(page, PYTHON_LOOP)).toHaveAttribute('data-state', 'running', { timeout: 60_000 })
  const started = Date.now()
  expect(await page.evaluate(() => 6 * 7)).toBe(42)
  await expect(resultOf(page, PYTHON_LOOP)).toHaveAttribute('data-state', 'error', { timeout: 15_000 })
  expect(Date.now() - started).toBeGreaterThan(4000)
  expect(Date.now() - started).toBeLessThan(9000)

  await runButton(page, PYTHON_LOOP).click()
  await expect(resultOf(page, PYTHON_LOOP)).toHaveAttribute('data-state', 'running', { timeout: 60_000 })
  await stopButton(page, PYTHON_LOOP).focus()
  await page.keyboard.press('Enter')
  await expect(resultOf(page, PYTHON_LOOP)).toHaveAttribute('data-state', 'stopped')
})

test('reader code cannot reach the network or evaluate JavaScript', async ({ page }) => {
  await openPlayground(page)
  const api = trackApiRequests(page)
  expect((await runPython(page, 'print("warm up")')).text).toBe('warm up')
  const before = [...api]
  const attempts: Array<[string, RegExp]> = [
    ['from js import fetch', /ImportError/],
    ['import js\njs.fetch(\'/api/posts\')', /AttributeError/],
    ['import js\njs.postMessage("x")', /AttributeError/],
    ['from pyodide.code import run_js\nrun_js("fetch(\'/api/posts\')")', /JsException|EvalError|ImportError/],
    ['from pyodide.http import pyfetch\nawait pyfetch(\'/api/posts\')', /./],
  ]
  for (const [code, expected] of attempts) {
    const run = await runPython(page, code)
    expect(run.state, code).toBe('error')
    expect(run.text, code).toMatch(expected)
  }
  expect(api).toEqual(before)
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
  await runPython(page, 'import json\nprint(json.dumps(1))')
  expect(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)).toEqual([])
  expect(messages).toEqual([])
})
