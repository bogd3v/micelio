import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { loadBuiltInTheme, locateBuiltInStore, watchBuiltInIndex } from '../server/lib/builtInStore'
import { isEntryDigest, themeAsset } from '../server/lib/themeAssets'
import { loadHooks } from '../modules/theme/hooks'
import { installTheme } from '../modules/theme/install/install'
import { loadEntrySync } from '../modules/theme/install/store'
import type { BuiltInIndex, LoadedEntry } from '../modules/theme/install/types'

const ROOT = resolve(__dirname, '..')
const HOOKS = loadHooks(join(ROOT, 'app'))
const temporary: string[] = []

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-serving-'))
  temporary.push(dir)
  return dir
}

/** A built-in store holding the starter, as the build writes it. */
async function builtInStore(): Promise<{ store: string, digest: string }> {
  const store = scratch()
  const result = await installTheme({ kind: 'folder', dir: join(ROOT, 'themes/starter') }, { storeDir: store, hooks: HOOKS, coreBuild: 'serving', allowCode: true })
  const index: BuiltInIndex = { coreBuild: 'serving', buildTheme: 'starter', themes: { starter: { digest: result.digest, version: '0.1.0', code: true } } }
  writeFileSync(join(store, 'index.json'), JSON.stringify(index))
  return { store, digest: result.digest }
}

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('themeAsset', () => {
  async function entry(): Promise<LoadedEntry> {
    const { store, digest } = await builtInStore()
    return loadEntrySync(store, digest)!
  }

  it('sends a file with its own content type and the headers of an immutable, sandboxed asset', async () => {
    const asset = themeAsset(await entry(), 'theme.css', undefined)!
    expect(asset.headers).toMatchObject({
      'content-type': 'text/css; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': expect.stringContaining('sandbox'),
      'vary': 'Accept-Encoding',
    })
    expect(asset.headers['content-encoding']).toBeUndefined()
    expect(asset.headers['content-length']).toBe(String(asset.body.length))
    expect(asset.body.toString()).toContain('@layer')
  })

  it('sends brotli or gzip only when the request accepts it, and honours q=0', async () => {
    const loaded = await entry()
    expect(themeAsset(loaded, 'theme.css', 'gzip, br')!.headers['content-encoding']).toBe('br')
    const gzip = themeAsset(loaded, 'theme.css', 'gzip;q=0.8, deflate')!
    expect(gzip.headers['content-encoding']).toBe('gzip')
    expect(gunzipSync(gzip.body).toString()).toBe(themeAsset(loaded, 'theme.css', undefined)!.body.toString())
    expect(themeAsset(loaded, 'theme.css', 'br;q=0, gzip;q=0')!.headers['content-encoding']).toBeUndefined()
    expect(themeAsset(loaded, 'theme.css', 'identity')!.headers['content-encoding']).toBeUndefined()
  })

  it('serves fonts and images from their folders with no Vary when there is no compressed copy', async () => {
    const loaded = await entry()
    const font = themeAsset(loaded, 'fonts/fraunces-latin-var.woff2', 'br')!
    expect(font.headers['content-type']).toBe('font/woff2')
    expect(font.headers.vary).toBeUndefined()
    expect(themeAsset(loaded, 'images/favicon.svg', undefined)!.headers['content-type']).toBe('image/svg+xml')
  })

  it('answers null for anything that is not exactly a file the manifest lists', async () => {
    const loaded = await entry()
    for (const path of ['', 'nope.css', '../theme.css', 'fonts/../theme.css', 'manifest.json', 'theme.css.br', 'theme.css.gz', '/theme.css', 'theme.css/', 'Theme.css', 'fonts', '__proto__', 'constructor', 'toString']) {
      expect(themeAsset(loaded, path, 'br'), path).toBeNull()
    }
    expect(themeAsset(undefined, 'theme.css', undefined)).toBeNull()
  })

  it('checks the grammar of a digest', () => {
    expect(isEntryDigest('a'.repeat(64))).toBe(true)
    for (const digest of ['', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), `sha256:${'a'.repeat(64)}`, '../'.repeat(22)]) expect(isEntryDigest(digest), digest).toBe(false)
  })

  it('keeps serving the bytes verified at load when the file is replaced on disk afterwards', async () => {
    const { store, digest } = await builtInStore()
    const loaded = loadEntrySync(store, digest)!
    const before = themeAsset(loaded, 'theme.css', undefined)!.body.toString()
    writeFileSync(join(store, 'v1/entries', digest, 'theme.css'), 'body{display:none}')
    expect(themeAsset(loaded, 'theme.css', undefined)!.body.toString()).toBe(before)
    expect(() => loadEntrySync(store, digest)).toThrow('does not match its manifest')
  })
})

describe('the built-in store of an image', () => {
  it('is found next to the server entry, looking up from the script node ran or from the chunk that asks', async () => {
    const { store } = await builtInStore()
    const server = scratch()
    cpSync(store, join(server, 'micelio/store'), { recursive: true })
    mkdirSync(join(server, 'chunks/nitro'), { recursive: true })
    const missing = join(scratch(), 'missing')
    expect(locateBuiltInStore([join(server, 'index.mjs')], missing)).toBe(join(server, 'micelio/store'))
    expect(locateBuiltInStore([join(server, 'chunks/nitro/nitro.mjs')], missing)).toBe(join(server, 'micelio/store'))
    // Nitro's chunk may report a placeholder as its own location: the entry script still finds it
    expect(locateBuiltInStore(['/_entry.js', join(server, 'index.mjs')], missing)).toBe(join(server, 'micelio/store'))
    expect(locateBuiltInStore(['', join(server, 'index.mjs')], missing)).toBe(join(server, 'micelio/store'))
  })

  it('falls back to the build\'s folder, and stops the boot when there is no store at all', async () => {
    const { store } = await builtInStore()
    expect(locateBuiltInStore([join(scratch(), 'index.mjs')], store)).toBe(store)
    expect(() => locateBuiltInStore([join(scratch(), 'index.mjs')], join(scratch(), 'none'))).toThrow('no built-in theme store')
  })

  it('loads the build\'s theme, or the one asked for, and names a theme it does not hold', async () => {
    const { store, digest } = await builtInStore()
    expect(loadBuiltInTheme(store).runtime.digest).toBe(digest)
    expect(loadBuiltInTheme(store, 'starter').entry.manifest.id).toBe('starter')
    expect(() => loadBuiltInTheme(store, 'nope')).toThrow('Theme "nope" is not in the built-in store; it holds: starter')
  })

  it('stops the boot on an entry that fails its manifest, its schema or its index', async () => {
    const { store, digest } = await builtInStore()
    const file = join(store, 'v1/entries', digest, 'theme.css')
    writeFileSync(file, `${readFileSync(file, 'utf8')} `)
    expect(() => loadBuiltInTheme(store)).toThrow('does not match its manifest')
    const other = await builtInStore()
    writeFileSync(join(other.store, 'index.json'), '{"coreBuild":"x"}')
    expect(() => loadBuiltInTheme(other.store)).toThrow()
  })
})

describe('watchBuiltInIndex', () => {
  it('loads the theme again only when the index changed, and keeps the old one when the new entry is broken', async () => {
    const { store, digest } = await builtInStore()
    const seen: string[] = []
    const failures: unknown[] = []
    const check = watchBuiltInIndex(store, () => loadBuiltInTheme(store), theme => seen.push(theme.runtime.digest), error => failures.push(error))
    check()
    expect(seen).toEqual([])
    // The build installed an edited theme: another entry and an index that names it
    const edited = join(scratch(), 'starter')
    cpSync(join(ROOT, 'themes/starter'), edited, { recursive: true })
    writeFileSync(join(edited, 'theme.css'), `${readFileSync(join(edited, 'theme.css'), 'utf8')}\n.edited{color:red}\n`)
    const result = await installTheme({ kind: 'folder', dir: edited }, { storeDir: store, hooks: HOOKS, coreBuild: 'serving', allowCode: true })
    const index: BuiltInIndex = { coreBuild: 'serving', buildTheme: 'starter', themes: { starter: { digest: result.digest, version: '0.1.0', code: true } } }
    await new Promise(settle => setTimeout(settle, 20))
    writeFileSync(join(store, 'index.json'), JSON.stringify(index))
    check()
    check()
    expect(seen).toEqual([result.digest])
    expect(result.digest).not.toBe(digest)
    // A broken entry is reported and nothing is replaced
    writeFileSync(join(store, 'v1/entries', result.digest, 'theme.css'), 'tampered')
    await new Promise(settle => setTimeout(settle, 20))
    writeFileSync(join(store, 'index.json'), JSON.stringify(index))
    check()
    expect(seen).toEqual([result.digest])
    expect(failures).toHaveLength(1)
    expect((failures[0] as Error).message).toContain('does not match its manifest')
  })
})
