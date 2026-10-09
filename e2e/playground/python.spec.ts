import { test, expect } from '@playwright/test'
import { openPlayground, playground, resultOf, runButton, stopButton, trackRuntimeRequests, QUERY } from '../fixtures/playground'
import { PYTHON, PYTHON_LOOP, runPython, trackApiRequests } from '../fixtures/python'

// The Python runtime (Pyodide, self-hosted) of the playground in the dynamic site, on every browser (ADR 0004, worker containment;
// ADR 0006, section 6). It runs in the same Worker policy as SQL: `wasm-unsafe-eval` but no `eval()`. The SQL suite is playground.spec.ts.

// Runtime files of /_islands/runtimes/: loaded once, when Run is pressed
const isPyodide = (path: string): boolean => /^\/_islands\/runtimes\/(?:python-|pyodide-)/.test(path)

test('nothing of Python loads until Run is pressed, then it runs the code and shows the expected output', async ({ page }) => {
  const loaded = trackRuntimeRequests(page)
  await openPlayground(page)
  await page.waitForLoadState('networkidle')
  expect(loaded).toEqual([])
  await runButton(page, PYTHON).click()
  await expect(resultOf(page, PYTHON)).toHaveAttribute('data-state', 'done', { timeout: 90_000 })
  const expected = await playground(page, PYTHON).locator('.myc-playground-output').textContent()
  expect(await resultOf(page, PYTHON).textContent()).toBe(expected)
  const files = loaded.filter(isPyodide).map(path => path.split('/').pop())
  expect(files.filter(name => name?.endsWith('.wasm'))).toEqual(['pyodide.asm.wasm'])
  expect(files).toEqual(expect.arrayContaining(['pyodide.mjs', 'pyodide.asm.mjs', 'python_stdlib.zip', 'pyodide-lock.json']))
  // SQL did not load: a Python page pays for Python only
  expect(loaded.some(path => /sqlite3|\/sql-/.test(path))).toBe(false)
})

test('the runtime downloads once for every Python playground, and SQL keeps its own', async ({ page }) => {
  const loaded = trackRuntimeRequests(page)
  await openPlayground(page)
  await runPython(page, 'print(1)')
  const first = loaded.filter(isPyodide)
  expect((await runPython(page, 'print(2)', PYTHON_LOOP)).text).toBe('2')
  expect((await runPython(page, 'print(3)')).text).toBe('3')
  expect(loaded.filter(isPyodide)).toEqual(first)
  // Another runtime of the same page loads its own, without touching Python's
  await runButton(page, QUERY).click()
  await expect(resultOf(page, QUERY)).toHaveAttribute('data-state', 'done', { timeout: 45_000 })
  expect(loaded.filter(isPyodide)).toEqual(first)
  expect((await runPython(page, 'print(4)')).text).toBe('4')
})

test('is operated with the keyboard and announces a short status', async ({ page }) => {
  await openPlayground(page)
  await runButton(page, PYTHON).focus()
  await page.keyboard.press('Enter')
  await expect(resultOf(page, PYTHON)).toHaveAttribute('data-state', 'done', { timeout: 90_000 })
  await expect(runButton(page, PYTHON)).toBeFocused()
  await expect(playground(page, PYTHON).locator('[data-playground-status]')).toHaveText(/^Terminó, \d+ líneas de salida\.$/)
})

test('an infinite loop is stopped after 5 seconds without freezing the page, and the next run works', async ({ page }) => {
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
  await runButton(page, PYTHON_LOOP).click()
  await expect(resultOf(page, PYTHON_LOOP)).toHaveAttribute('data-state', 'running', { timeout: 90_000 })
  const started = Date.now()
  expect(await page.evaluate(() => 6 * 7)).toBe(42)
  await expect(resultOf(page, PYTHON_LOOP)).toHaveAttribute('data-state', 'error', { timeout: 15_000 })
  const elapsed = Date.now() - started
  expect(elapsed).toBeGreaterThan(4000)
  expect(elapsed).toBeLessThan(9000)
  expect(await page.evaluate(() => (window as unknown as { __longestGap: number }).__longestGap)).toBeLessThan(1000)
  // The terminated Worker is replaced by a new one that loads Python again
  expect((await runPython(page, 'print("again")')).text).toBe('again')
})

test('Stop ends a run at once, from the keyboard', async ({ page }) => {
  await openPlayground(page)
  await runButton(page, PYTHON_LOOP).click()
  await expect(resultOf(page, PYTHON_LOOP)).toHaveAttribute('data-state', 'running', { timeout: 90_000 })
  await stopButton(page, PYTHON_LOOP).focus()
  await page.keyboard.press('Enter')
  await expect(resultOf(page, PYTHON_LOOP)).toHaveAttribute('data-state', 'stopped')
  await expect(runButton(page, PYTHON_LOOP)).toBeFocused()
})

test('stdout and stderr come out in order, an error keeps what was printed before it, and a traceback starts at the reader\'s code', async ({ page }) => {
  await openPlayground(page)
  const mixed = await runPython(page, 'import sys\nprint("out 1")\nprint("err 1", file=sys.stderr)\nprint("out 2")')
  expect(mixed).toEqual({ state: 'done', text: 'out 1\nerr 1\nout 2' })
  const failed = await runPython(page, 'print("before")\nvalue = {}["missing"]')
  expect(failed.state).toBe('error')
  expect(failed.text).toContain('before')
  expect(failed.text).toContain('KeyError')
  expect(failed.text).toContain('File "<exec>", line 2')
  expect(failed.text).not.toContain('_pyodide')
  const syntax = await runPython(page, 'def broken(:\n  pass')
  expect(syntax.state).toBe('error')
  expect(syntax.text).toContain('SyntaxError')
})

test('each run has a namespace of its own, the hidden setup runs first, and there is no input', async ({ page }) => {
  await openPlayground(page)
  expect((await runPython(page, 'leftover = 1\nprint(__name__)')).text).toBe('__main__')
  expect((await runPython(page, 'print("leftover" in globals())')).text).toBe('False')
  // The setup of the first playground defines `tools`
  expect((await runPython(page, 'print(sorted(tools))')).text).toBe('[\'sqlite\', \'vite\']')
  const input = await runPython(page, 'input("name? ")', PYTHON_LOOP)
  expect(input.state).toBe('error')
  expect(input.text).toContain('EOFError')
})

test('the standard library works, and so do top-level await and asyncio', async ({ page }) => {
  await openPlayground(page)
  const code = [
    'import asyncio, json, math, re, statistics, collections, dataclasses, datetime, decimal, fractions, itertools, random, textwrap',
    'print(json.dumps({"pi": round(math.pi, 3)}), statistics.mean([1, 2, 3]), decimal.Decimal("0.1") + decimal.Decimal("0.2"))',
    'async def main():',
    '    await asyncio.sleep(0.05)',
    '    return "slept"',
    'print(await main())',
    'print(re.findall(r"\\d+", "a1b22c333"))',
  ].join('\n')
  const run = await runPython(page, code)
  expect(run.text).toBe('{"pi": 3.142} 2 0.3\nslept\n[\'1\', \'22\', \'333\']')
  expect(run.state).toBe('done')
})

test('a program that prints for ever is capped at 64 KB and stopped at 5 seconds, and one that eats memory fails without taking the page down', async ({ page }) => {
  // Workers are started and killed in turn, one of them eating memory: a loaded machine needs more than the default minute
  test.setTimeout(120_000)
  await openPlayground(page)
  const flood = await runPython(page, 'for i in range(20000):\n    print("x" * 100, i)')
  expect(flood.state).toBe('done')
  expect(Buffer.byteLength(flood.text)).toBeGreaterThan(60 * 1024)
  expect(Buffer.byteLength(flood.text)).toBeLessThan(64 * 1024 + 120)
  expect(flood.text).toContain('Salida cortada')
  const endless = await runPython(page, 'while True:\n    print("x" * 100)')
  expect(endless.state).toBe('error')
  expect(Buffer.byteLength(endless.text)).toBeLessThan(64 * 1024 + 200)
  const hog = await runPython(page, 'chunks = []\nwhile True:\n    chunks.append(bytearray(50_000_000))')
  expect(hog.state).toBe('error')
  expect(await page.evaluate(() => 6 * 7)).toBe(42)
  // The Worker is good for the next run, or is replaced by a new one
  expect((await runPython(page, 'print("alive")')).text).toBe('alive')
})

test('markup in the output is text, never HTML', async ({ page }) => {
  await openPlayground(page)
  const run = await runPython(page, 'print("<img src=x onerror=window.__xss=1>")')
  expect(run.text).toBe('<img src=x onerror=window.__xss=1>')
  expect(await resultOf(page, PYTHON).locator('img').count()).toBe(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
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
  const before = await violations()
  const consoleBefore = messages.length
  await runPython(page, 'import json, asyncio\nawait asyncio.sleep(0)\nprint(json.dumps([1]))')
  expect(await violations()).toEqual(before)
  expect(messages.slice(consoleBefore)).toEqual([])
})

// What reader code can reach from inside the Worker (docs/security.md, "Python runtime"). The `js` module is a small frozen object (an extra
// layer); the boundary is the Worker's CSP and the removal of the network and storage globals once Pyodide is loaded. Pyodide keeps no
// reference of its own to `fetch`.
test.describe('sandbox', () => {
  test('the js module has no Worker scope, no network and no storage', async ({ page }) => {
    await openPlayground(page)
    const absent = ['postMessage', 'self', 'globalThis', 'WebAssembly', 'ArrayBuffer', 'crypto', 'Blob', 'URL', 'navigator', 'fetch', 'XMLHttpRequest', 'WebSocket', 'WebTransport', 'EventSource', 'importScripts', 'SharedWorker', 'Worker', 'BroadcastChannel', 'caches', 'indexedDB', 'eval', 'Function', 'Request', 'Response']
    const code = [
      'import js',
      `for name in ${JSON.stringify(absent)}:`,
      '    print(name, "reachable" if hasattr(js, name) else "absent")',
      'print(js.JSON.stringify(js.Array.new(1, 2)))',
    ].join('\n')
    const run = await runPython(page, code)
    expect(run.state).toBe('done')
    expect(run.text.split('\n')).toEqual([...absent.map(name => `${name} absent`), '[1,2]'])
  })

  test('asyncio, timers and console still work through the restricted js module', async ({ page }) => {
    await openPlayground(page)
    const code = [
      'import asyncio, js',
      'from pyodide.ffi import create_proxy',
      'await asyncio.sleep(0.1)',
      'async def tick(n):',
      '    await asyncio.sleep(0.01)',
      '    return n',
      'print(await asyncio.gather(tick(1), tick(2)))',
      'done = asyncio.get_event_loop().create_future()',
      'js.setTimeout(create_proxy(lambda: done.set_result("timer")), 10)',
      'print(await done)',
      'js.console.log("to the console")',
    ].join('\n')
    const run = await runPython(page, code)
    expect(run.text).toBe('[1, 2]\ntimer')
    expect(run.state).toBe('done')
  })

  test('from js import fetch, and js.fetch, fail', async ({ page }) => {
    await openPlayground(page)
    const api = trackApiRequests(page)
    await runPython(page, 'print("warm up")')
    const before = [...api]
    const imported = await runPython(page, 'from js import fetch')
    expect(imported.state).toBe('error')
    expect(imported.text).toMatch(/ImportError/)
    const attribute = await runPython(page, 'import js\njs.fetch(\'/api/posts\')')
    expect(attribute.state).toBe('error')
    expect(attribute.text).toMatch(/AttributeError/)
    for (const code of ['import js\njs.globalThis.fetch(\'/api/posts\')', 'import js\njs.self.XMLHttpRequest.new()', 'import js\njs.postMessage("x")', 'import js\njs.WebAssembly.compile(js.ArrayBuffer.new(8))']) {
      const run = await runPython(page, code)
      expect(run.state, code).toBe('error')
      expect(run.text, code).toMatch(/AttributeError/)
    }
    expect(api).toEqual(before)
  })

  test('evaluating JavaScript is blocked by the Worker policy', async ({ page }) => {
    await openPlayground(page)
    const api = trackApiRequests(page)
    await runPython(page, 'print("warm up")')
    const before = [...api]
    // js.eval is not in the module, so run_js cannot even import it; the way left to a string of code is the Function constructor
    const attempts = [
      'import js\njs.Object.constructor(\'return fetch\')()',
      'import js\njs.setTimeout.constructor(\'return 1\')()',
      'from pyodide.code import run_js\nrun_js(\'1 + 1\')',
      'from pyodide.code import run_js\nrun_js("fetch(\'/api/posts\')")',
    ]
    for (const code of attempts) {
      const run = await runPython(page, code)
      expect(run.state, code).toBe('error')
      expect(run.text, code).toMatch(/JsException|EvalError|ImportError/)
    }
    expect(api).toEqual(before)
  })

  test('Pyodide\'s file systems reach no storage: IDBFS has no indexedDB to sync with', async ({ page }) => {
    await openPlayground(page)
    const code = [
      'import js, pyodide_js',
      'from pyodide.ffi import create_proxy',
      'fs = pyodide_js.FS',
      'fs.mkdir("/idb")',
      'fs.mount(fs.filesystems.IDBFS, js.Object.new(), "/idb")',
      'errors = []',
      'fs.syncfs(True, create_proxy(lambda error: errors.append(str(error))))',
      'print(errors)',
    ].join('\n')
    const run = await runPython(page, code)
    expect(run.state).toBe('done')
    expect(run.text).toMatch(/indexedDB/)
  })

  test('Pyodide\'s own network paths do not work: pyfetch, open_url and loadPackage', async ({ page }) => {
    await openPlayground(page)
    const requests: string[] = []
    page.context().on('request', request => requests.push(new URL(request.url()).pathname))
    await runPython(page, 'print("warm up")')
    const before = requests.length
    const pyfetch = await runPython(page, 'from pyodide.http import pyfetch\nresponse = await pyfetch(\'/api/posts\')\nprint(response.status)')
    expect(pyfetch.state).toBe('error')
    const openUrl = await runPython(page, 'from pyodide.http import open_url\nprint(open_url(\'/api/posts\').read())')
    expect(openUrl.state).toBe('error')
    // loadPackage fetches with the global `fetch`; none of these reaches the server
    const loaded = await runPython(page, 'import pyodide_js\nawait pyodide_js.loadPackage(\'/not-a-package/x-1.0-py3-none-any.whl\')\nawait pyodide_js.loadPackage(\'numpy\')')
    expect(loaded.state).toBe('error')
    const micropip = await runPython(page, 'import micropip')
    expect(micropip.state).toBe('error')
    expect(micropip.text).toContain('ModuleNotFoundError')
    expect(requests.slice(before).filter(path => !path.startsWith('/_islands/'))).toEqual([])
    expect(requests.slice(before).filter(path => path.includes('not-a-package') || path.startsWith('/api/'))).toEqual([])
  })

  test('the interpreter is shared by the Python blocks of a page: modules, builtins and the file system persist', async ({ page }) => {
    await openPlayground(page)
    await runPython(page, 'import builtins, sys\nbuiltins.shared_marker = 42\nopen("/tmp/shared.txt", "w").write("kept")\nsys.modules["math"].marker = 1')
    const other = await runPython(page, 'import builtins, math\nprint(builtins.shared_marker, open("/tmp/shared.txt").read(), math.marker, "shared_marker" in globals())', PYTHON_LOOP)
    expect(other).toEqual({ state: 'done', text: '42 kept 1 False' })
  })

  test('code cannot reach postMessage to forge a reply: a message it could send would not restart the 5 second clock', async ({ page }) => {
    await openPlayground(page)
    // Every route to the Worker's postMessage that was found: the js module, Pyodide's module object and the API object
    const code = [
      'import js, pyodide_js',
      'found = []',
      'for label, target in (("js", js), ("pyodide_js", pyodide_js), ("module", pyodide_js._module), ("api", pyodide_js._api)):',
      '    for name in ("postMessage", "self", "globalThis"):',
      '        if hasattr(target, name):',
      '            found.append(label + "." + name)',
      'print(found)',
    ].join('\n')
    const run = await runPython(page, code)
    expect(run.state).toBe('done')
    expect(run.text).toBe('[]')
  })

  test('a line printed without its newline is kept, and does not leak into the next run', async ({ page }) => {
    await openPlayground(page)
    expect((await runPython(page, 'print("no newline", end="")')).text).toBe('no newline')
    expect((await runPython(page, 'import sys\nsys.stdout.write("partial")\nraise ValueError("x")')).text).toContain('partial')
    expect((await runPython(page, 'print("clean")')).text).toBe('clean')
  })

  test('a callback handed to a timer or a microtask never receives the Worker\'s scope as `this`', async ({ page }) => {
    await openPlayground(page)
    const code = [
      'import asyncio, js',
      'from pyodide.ffi import create_proxy',
      'seen = []',
      'def grab(*args):',
      '    seen.append(args)',
      'def proxy():',
      '    return create_proxy(grab, capture_this=True)',
      'js.setTimeout(proxy(), 0, "a")',
      'interval = js.setInterval(proxy(), 5, "b")',
      'js.queueMicrotask(proxy())',
      'js.Promise.resolve(1).then(proxy())',
      'js.Array.new(1, 2).forEach(proxy())',
      'await asyncio.sleep(0.1)',
      'js.clearInterval(interval)',
      'reach = [name for args in seen for a in args for name in ("postMessage", "self", "globalThis", "fetch") if hasattr(a, name)]',
      'print(len(seen) >= 6, reach)',
    ].join('\n')
    const run = await runPython(page, code)
    expect(run).toEqual({ state: 'done', text: 'True []' })
  })

  test('a timer given a string of code is refused', async ({ page }) => {
    await openPlayground(page)
    for (const call of ['js.setTimeout("1", 0)', 'js.setInterval("1", 0)', 'js.queueMicrotask("1")']) {
      const run = await runPython(page, `import js\n${call}`)
      expect(run.state, call).toBe('error')
      expect(run.text, call).toMatch(/needs a function|TypeError/)
    }
  })

  test('work left running at the end of a run is cancelled and writes nothing into the next one', async ({ page }) => {
    await openPlayground(page)
    const start = [
      'import asyncio, js',
      'from pyodide.ffi import create_proxy',
      'def tick():',
      '    print("tick")',
      'js.setInterval(create_proxy(tick), 10)',
      'async def forever():',
      '    while True:',
      '        await asyncio.sleep(0.01)',
      '        print("task")',
      'asyncio.ensure_future(forever())',
      'await asyncio.sleep(0.1)',
    ].join('\n')
    const first = await runPython(page, start)
    expect(first.state).toBe('done')
    expect(first.text).toContain('tick')
    // Another block, a moment later: nothing of the first one is left to print
    const second = await runPython(page, 'import asyncio\nawait asyncio.sleep(0.2)\nprint("quiet")', PYTHON_LOOP)
    expect(second).toEqual({ state: 'done', text: 'quiet' })
  })
})
