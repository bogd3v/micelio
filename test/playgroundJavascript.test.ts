import { describe, expect, it } from 'vitest'
import { runtimeDownloads } from '../app/helpers/playgroundRuntimes'
import loadJavaScript from '../app/islands/runtimes/javascript'
import type { RunLimits } from '../app/islands/types'

const LIMITS: RunLimits = { deadlineMs: 4000, outputBytes: 64 * 1024 }

describe('JavaScript runtime files', () => {
  it('counts the runtime, the loader chunks of QuickJS and its WebAssembly, and nothing of another runtime', () => {
    const sizes = new Map([
      ['runtimes/javascript-BFx3NMGY.js', 1024],
      ['runtimes/ffi-4V2b7xu3.js', 1024],
      ['runtimes/module-ES6BEMUI-Ci-jaF3u.js', 1024],
      ['runtimes/emscripten-module.browser-CeUe2849.js', 1024],
      ['runtimes/emscripten-module-uFzwHH0Y.wasm', 2048],
      ['runtimes/sql-CLJSAl9U.js', 4096],
      ['workers/playground-B4P1UfOh.js', 100],
    ])
    expect(runtimeDownloads(sizes).javascript).toBe(6)
    expect(runtimeDownloads(sizes).sql).toBe(4)
  })
})

describe('JavaScript runtime', () => {
  async function run(code: string, setup = ''): Promise<string> {
    return (await loadJavaScript()).run(code, setup, LIMITS)
  }
  async function failure(code: string): Promise<string> {
    try {
      await run(code)
    } catch (error) {
      return (error as Error).message
    }
    return ''
  }

  it('shows the console output and the value of the last expression', async () => {
    expect(await run('console.log("a", 1, {b: [2]}); console.warn("w"); 40 + 2')).toBe('a 1 {\n  "b": [\n    2\n  ]\n}\nwarn: w\n42')
    expect(await run('const x = 1;')).toBe('')
  })

  it('runs the hidden setup silent, in the same context', async () => {
    expect(await run('total * 2', 'const total = 21; console.log("hidden")')).toBe('42')
  })

  it('runs promise callbacks and shows a settled promise', async () => {
    expect(await run('Promise.resolve(7).then(v => console.log("then", v)); Promise.resolve("done")')).toBe('then 7\ndone')
  })

  it('reports a thrown error after the output that came before it', async () => {
    expect(await failure('console.log("before"); throw new TypeError("nope")')).toBe('before\nTypeError: nope')
  })

  it('gives the guest nothing of the host', async () => {
    for (const name of ['fetch', 'XMLHttpRequest', 'setTimeout', 'importScripts', 'self', 'postMessage', 'WebAssembly', 'require', 'process']) {
      expect(await run(`typeof ${name}`), name).toBe('undefined')
    }
    for (const code of ['eval("1")', '(0, eval)("1")', 'new Function("return 1")', 'this.constructor.constructor("return this")()', '(function () {}).constructor("return 1")()', '(async () => {}).constructor("return 1")', 'import("x")']) {
      expect(await failure(code), code).toBeTruthy()
    }
    expect(await failure('eval("1")')).toContain('Code generation from strings is disabled')
  })

  it('interrupts a loop that never ends', async () => {
    expect(await failure('while (true) {}')).toContain('Interrupted')
  })

  it('stops the memory a loop asks for, and runaway recursion', async () => {
    expect(await failure('const a = []; while (true) a.push(new Array(1e6).fill(1))')).toContain('memory')
    expect(await failure('function f() { return f() + 1 } f()')).toMatch(/stack|recursion/i)
  })

  it('stops a loop that only logs, and returns what it wrote', async () => {
    const output = await run('while (true) console.log("x".repeat(100))')
    expect(output.length).toBeGreaterThan(64 * 1024)
  })

  it('shows a promise that never settles, and an error from a rejected one', async () => {
    expect(await run('new Promise(() => {})')).toBe('Promise { <pending> }')
    expect(await failure('Promise.reject(new Error("x"))')).toBe('Error: x')
  })

  it('reports a self-scheduling promise chain as interrupted, not as done', async () => {
    const runtime = await loadJavaScript()
    expect(() => runtime.run('const again = () => { Promise.resolve().then(again) }; again(); 1', '', LIMITS)).toThrow(/Interrupted/)
    expect(runtime.recycle?.()).toBe(true)
  }, 15_000)

  it('survives a bomb, an endless loop and a stack overflow on one instance, and asks to be replaced', async () => {
    const runtime = await loadJavaScript()
    for (const code of ['const hold = []; while (true) hold.push(new Array(1e6).fill(1))', 'while (true) {}', 'function f() { return f() + 1 } f()']) {
      expect(() => runtime.run(code, '', LIMITS), code).toThrow()
      expect(runtime.recycle?.(), code).toBe(true)
    }
    expect(runtime.run('1 + 1', '', LIMITS)).toBe('2')
    expect(runtime.recycle?.()).toBe(false)
  }, 30_000)

  it('does not ask to be replaced for an ordinary error', async () => {
    const runtime = await loadJavaScript()
    expect(() => runtime.run('throw new Error("plain")', '', LIMITS)).toThrow('plain')
    expect(runtime.recycle?.()).toBe(false)
  })

  it('never keeps one huge line whole', async () => {
    const runtime = await loadJavaScript()
    const output = runtime.run('console.log("x".repeat(30 * 1024 * 1024))', '', LIMITS)
    expect(output.length).toBeLessThanOrEqual(128 * 1024)
    expect(runtime.recycle?.()).toBe(true)
  })
})
