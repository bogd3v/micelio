import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { loadHooks } from '../modules/theme/hooks'
import { compileTheme } from '../modules/theme/install/compile'
import { InstallError } from '../modules/theme/install/error'
import { installIsolated } from '../modules/theme/install/isolated'
import { loadEntry } from '../modules/theme/install/store'
import type { InstallOptions } from '../modules/theme/install/types'
import { discoverThemes } from '../modules/theme/themes'

const ROOT = resolve(__dirname, '..')
const HOOKS = loadHooks(join(ROOT, 'app'))
const temporary: string[] = []

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-isolated-'))
  temporary.push(dir)
  return dir
}

function dataOnly(): string {
  const dir = join(scratch(), 'starter')
  cpSync(join(ROOT, 'themes/starter'), dir, { recursive: true })
  rmSync(join(dir, 'slots'), { recursive: true })
  return dir
}

function options(): InstallOptions {
  return { storeDir: scratch(), hooks: HOOKS, coreBuild: 'test-build' }
}

/** Deterministic high-entropy rules: distinct selectors and values that compress badly, `bytes` long. */
function dense(bytes: number): string {
  let seed = 12345
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed
  }
  const rules: string[] = []
  let size = 0
  for (let i = 0; size < bytes; i++) {
    const rule = `.t${i.toString(36)}-${next().toString(36)} > .u${next().toString(36)}:not(.v${next().toString(36)}):is(.w${next().toString(36)},.x${next().toString(36)}){margin:${next() % 97}px ${next() % 89}px;color:rgb(${next() % 256} ${next() % 256} ${next() % 256});padding:calc(${next() % 50}px + ${next() % 7}vw)}`
    rules.push(rule)
    size += rule.length
  }
  return rules.join('\n')
}

async function failure(run: Promise<unknown>): Promise<unknown> {
  try {
    await run
  } catch (error) {
    return error
  }
  throw new Error('expected a failure')
}

function worker(body: string): string {
  const file = join(scratch(), 'worker.mjs')
  writeFileSync(file, body)
  return file
}

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('installIsolated', () => {
  it('installs in a child process and reports its peak memory', async () => {
    const opts = options()
    const result = await installIsolated({ kind: 'folder', dir: dataOnly() }, opts)
    expect(result.created).toBe(true)
    expect(result.maxRssKb).toBeGreaterThan(0)
    expect(await loadEntry(opts.storeDir, result.digest)).not.toBeNull()
  })

  it('brings an install failure back as the same InstallError', async () => {
    const dir = dataOnly()
    writeFileSync(join(dir, 'theme.css'), '.a{background:url(https://example.com/a.png)}')
    const error = await failure(installIsolated({ kind: 'folder', dir }, options()))
    expect(error).toBeInstanceOf(InstallError)
    expect(error).toMatchObject({ rule: 'validation' })
    expect((error as InstallError).message).toContain('https://example.com/a.png')
  })

  it('runs one install at a time', async () => {
    const opts = options()
    const dir = dataOnly()
    const results = await Promise.all([installIsolated({ kind: 'folder', dir }, opts), installIsolated({ kind: 'folder', dir }, opts)])
    expect(results.map(result => result.created).sort()).toEqual([false, true])
  })

  it('stops an install that runs past the timeout, and the next one still works', async () => {
    const hang = worker('process.once("message", () => { for (;;); })')
    const started = Date.now()
    await expect(installIsolated({ kind: 'folder', dir: dataOnly() }, options(), { worker: hang, timeoutMs: 500 })).rejects.toMatchObject({ rule: 'compile', detail: expect.stringContaining('ran past 500 ms') })
    expect(Date.now() - started).toBeLessThan(5000)
    expect((await installIsolated({ kind: 'folder', dir: dataOnly() }, options())).created).toBe(true)
  })

  it('stops an install that runs out of memory', async () => {
    const greedy = worker('process.once("message", () => { const kept = []; for (;;) kept.push(new Array(1e6).fill(1)) })')
    await expect(installIsolated({ kind: 'folder', dir: dataOnly() }, options(), { worker: greedy, heapMb: 32, timeoutMs: 20_000 })).rejects.toMatchObject({ rule: 'compile', detail: expect.stringContaining('stopped before it answered') })
  })

  it('does not hand the child the environment of the server', async () => {
    process.env.MICELIO_TEST_SECRET = 'do-not-leak'
    const probe = worker('process.once("message", () => { process.send({ ok: false, rule: "compile", subject: {}, detail: String(process.env.MICELIO_TEST_SECRET) }) })')
    try {
      await expect(installIsolated({ kind: 'folder', dir: dataOnly() }, options(), { worker: probe })).rejects.toMatchObject({ detail: 'undefined' })
    } finally {
      delete process.env.MICELIO_TEST_SECRET
    }
  })
})

describe('what the installer loads', () => {
  function runPlain(dir: string, extra: string): string {
    const script = join(scratch(), 'install.mjs')
    writeFileSync(script, `
      import { createRequire } from 'node:module'
      const Module = createRequire(import.meta.url)('node:module')
      const resolve = Module._resolveFilename
      Module._resolveFilename = function (request, ...rest) {
        if (request === '@vue/compiler-sfc') throw new Error('compiler-sfc was loaded')
        return resolve.call(this, request, ...rest)
      }
      const { installTheme } = await import(${JSON.stringify(join(ROOT, 'modules/theme/install/install.ts'))})
      const { loadHooks } = await import(${JSON.stringify(join(ROOT, 'modules/theme/hooks.ts'))})
      const hooks = loadHooks(${JSON.stringify(join(ROOT, 'app'))})
      try {
        const result = await installTheme({ kind: 'folder', dir: ${JSON.stringify(dir)} }, { storeDir: ${JSON.stringify(scratch())}, hooks, coreBuild: 'plain', ${extra} })
        console.log('installed ' + result.digest)
      } catch (error) {
        console.log('failed ' + error.message)
      }
    `)
    return execFileSync(process.execPath, [join(ROOT, 'node_modules/jiti/lib/jiti-cli.mjs'), script], { encoding: 'utf8', cwd: scratch() })
  }

  it('does not load @vue/compiler-sfc for a theme with no slots', () => {
    expect(runPlain(dataOnly(), '')).toMatch(/^installed [0-9a-f]{64}$/m)
  })

  it('loads it only to check a slot', () => {
    expect(runPlain(join(ROOT, 'themes/starter'), 'allowCode: true')).toContain('compiler-sfc was loaded')
  })
})

describe('the largest stylesheets the caps allow', () => {
  it('installs the densest theme.css the 25 KiB gzip budget lets through, within time and memory', async () => {
    const dir = dataOnly()
    let css = dense(40_000)
    for (let bytes = 40_000; gzipSync(css).length < 24 * 1024; bytes += 2_000) css = dense(bytes)
    writeFileSync(join(dir, 'theme.css'), css)
    const started = Date.now()
    const result = await installIsolated({ kind: 'folder', dir }, options(), { timeoutMs: 30_000 })
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(20_000)
    expect(result.maxRssKb / 1024).toBeLessThan(512)
  })

  it('compiles a stylesheet at the 1 MiB compile cap, or refuses it, within time', async () => {
    const dir = dataOnly()
    writeFileSync(join(dir, 'theme.css'), dense(1024 * 1024))
    const theme = discoverThemes([dir])[0]!
    const started = Date.now()
    let refused: unknown
    try {
      await compileTheme({ theme, packageDigest: `sha256:${'a'.repeat(64)}`, code: false, coreBuild: 'x' })
    } catch (error) {
      refused = error
    }
    expect(Date.now() - started).toBeLessThan(20_000)
    expect(refused === undefined || refused instanceof InstallError).toBe(true)
  })
})
