import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadHooks } from '../modules/theme/hooks'
import { parseRuntime } from '../modules/theme/install/runtime'
import { installTheme } from '../modules/theme/install/install'
import { loadEntry, loadEntrySync } from '../modules/theme/install/store'
import type { LoadedEntry, RuntimeData } from '../modules/theme/install/types'

const ROOT = resolve(__dirname, '..')
const HOOKS = loadHooks(join(ROOT, 'app'))
const temporary: string[] = []

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-runtime-'))
  temporary.push(dir)
  return dir
}

/** The starter installed into a store, as the build does it. */
async function builtInStore(): Promise<{ store: string, digest: string }> {
  const store = scratch()
  const result = await installTheme({ kind: 'folder', dir: join(ROOT, 'themes/starter') }, { storeDir: store, hooks: HOOKS, coreBuild: 'runtime', allowCode: true })
  return { store, digest: result.digest }
}

function runtimeOf(entry: LoadedEntry): RuntimeData {
  return JSON.parse(entry.files.get('runtime.json')!.toString()) as RuntimeData
}

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('loadEntrySync', () => {
  it('returns what the async loader returns, and null for an entry that is not there', async () => {
    const { store, digest } = await builtInStore()
    const sync = loadEntrySync(store, digest)!
    const async = (await loadEntry(store, digest))!
    expect(sync.manifest).toEqual(async.manifest)
    expect([...sync.files].map(([path, data]) => [path, data.toString('base64')])).toEqual([...async.files].map(([path, data]) => [path, data.toString('base64')]))
    expect(loadEntrySync(store, 'f'.repeat(64))).toBeNull()
  })

  it('refuses a changed, a missing and an extra file, and a malformed digest', async () => {
    const { store, digest } = await builtInStore()
    const dir = join(store, 'v1/entries', digest)
    writeFileSync(join(dir, 'extra.js'), 'x')
    expect(() => loadEntrySync(store, digest)).toThrow('differ from its manifest')
    rmSync(join(dir, 'extra.js'))
    rmSync(join(dir, 'runtime.json'))
    expect(() => loadEntrySync(store, digest)).toThrow('differ from its manifest')
    expect(() => loadEntrySync(store, '../..')).toThrow('malformed')
  })
})

describe('parseRuntime', () => {
  async function parts(): Promise<{ runtime: RuntimeData, digest: string }> {
    const { store, digest } = await builtInStore()
    return { runtime: runtimeOf(loadEntrySync(store, digest)!), digest }
  }
  const parse = (runtime: unknown, digest: string): RuntimeData => parseRuntime(Buffer.from(JSON.stringify(runtime)), digest)

  it('accepts what the compiler wrote', async () => {
    const { runtime, digest } = await parts()
    expect(parse(runtime, digest).id).toBe('starter')
  })

  it('refuses a value that could break out of HTML, a header or the entry folder', async () => {
    const { runtime, digest } = await parts()
    const modeKey = Object.keys(runtime.palette.modes)[0]!
    // A change is a path into the runtime data and the value to put there
    const cases: Array<[string, Array<string | number>, unknown]> = [
      ['a tag in the name', ['name'], '<script>alert(1)</script>'],
      ['a quote in a mode id', ['modes', 0, 'id'], 'light" onload="x'],
      ['a font URL elsewhere', ['fonts', 0, 'url'], 'https://example.com/a.woff2'],
      ['a font file with a path', ['fonts', 0, 'file'], '../x.woff2'],
      ['an image URL elsewhere', ['images', 'favicon'], '/_t/other/images/a.svg'],
      ['an image path with dots', ['images', 'favicon'], `/_t/${digest}/images/../../x`],
      ['a prototype key in the messages', ['messages', 'en'], JSON.parse('{"__proto__":{"t":0}}')],
      ['an unknown node type', ['messages', 'en'], { hero: { t: 42 } }],
      ['a message that is not a node', ['messages', 'en'], { hero: 'plain' }],
      ['a node with an unknown key', ['messages', 'en'], { hero: { t: 0, run: 'x' } }],
      ['a palette color that is not a color', ['palette', 'modes', modeKey, 'accent'], 'red;}'],
      ['an extra field', ['extra'], true],
      ['a layout variant with a slash', ['layout', 'header'], 'bar/../x'],
      ['a control character in a family', ['display', 'family'], 'Bad\nFamily'],
    ]
    for (const [name, path, value] of cases) {
      const copy = structuredClone(runtime) as unknown as Record<string, unknown>
      let target: Record<string | number, unknown> = copy
      for (const key of path.slice(0, -1)) target = target[key] as Record<string | number, unknown>
      target[path.at(-1)!] = value
      expect(() => parse(copy, digest), name).toThrow(/^runtime\.json/)
    }
  })

  it('refuses a file for another entry, a messages tree that is too deep and text that is not JSON', async () => {
    const { runtime, digest } = await parts()
    expect(() => parse(runtime, 'e'.repeat(64))).toThrow('another entry')
    let deep: Record<string, unknown> = { t: 3, v: 'x' }
    for (let level = 0; level < 40; level++) deep = { t: 2, i: [deep] }
    expect(() => parse({ ...runtime, messages: { en: { deep } } }, digest)).toThrow('too large')
    expect(() => parseRuntime(Buffer.from('{'), digest)).toThrow('not valid JSON')
  })

  it('does not echo the offending value', async () => {
    const { runtime, digest } = await parts()
    const copy = structuredClone(runtime) as RuntimeData
    copy.name = '<img src=x onerror=SECRET>'
    expect(() => parse(copy, digest)).toThrow(/^(?!.*SECRET)/s)
  })
})
