import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadHooks } from '../modules/theme/hooks'
import { InstallError } from '../modules/theme/install/error'
import { installedEntry, installTheme } from '../modules/theme/install/install'
import { compileKey } from '../modules/theme/install/compile'
import { cleanTemporary, loadEntry, writeEntry } from '../modules/theme/install/store'
import type { InstallOptions, InstallRule } from '../modules/theme/install/types'
import { buildPackage } from '../modules/theme/registry/build'
import { discoverThemes } from '../modules/theme/themes'

const ROOT = resolve(__dirname, '..')
const HOOKS = loadHooks(join(ROOT, 'app'))
const temporary: string[] = []

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-install-'))
  temporary.push(dir)
  return dir
}

/** A copy of the starter without `slots/`: a data-only theme, with a folder to edit. */
function dataOnly(): string {
  const dir = join(scratch(), 'starter')
  cpSync(join(ROOT, 'themes/starter'), dir, { recursive: true })
  rmSync(join(dir, 'slots'), { recursive: true })
  return dir
}

function options(storeDir: string, extra: Partial<InstallOptions> = {}): InstallOptions {
  return { storeDir, hooks: HOOKS, coreBuild: 'test-build', ...extra }
}

async function failure(run: Promise<unknown>): Promise<InstallError> {
  try {
    await run
  } catch (error) {
    if (error instanceof InstallError) return error
    throw error
  }
  throw new Error('expected an InstallError')
}

function listAll(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? listAll(dir, `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]))
}

/** Every entry file of a store with its bytes, to compare two stores. */
function snapshot(store: string): Record<string, string> {
  const entries = join(store, 'v1/entries')
  return Object.fromEntries(listAll(entries).map(path => [path, readFileSync(join(entries, path)).toString('base64')]))
}

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('installing a theme folder', () => {
  it('compiles Bogota into a store entry', async () => {
    const store = scratch()
    const result = await installTheme({ kind: 'folder', dir: join(ROOT, 'themes/bogota') }, options(store, { allowCode: true }))
    expect(result.created).toBe(true)
    expect(result.manifest.code).toBe(true)
    const entry = (await loadEntry(store, result.digest))!
    const paths = [...entry.files.keys()]
    for (const path of ['theme.css', 'theme.css.gz', 'theme.css.br', 'sections.css', 'runtime.json', 'runtime.json.gz']) expect(paths).toContain(path)
    expect(paths.some(path => path.startsWith('fonts/') && path.endsWith('.woff2'))).toBe(true)
    expect(paths.some(path => path.startsWith('fonts/') && path.endsWith('.txt'))).toBe(true)
    expect(paths.some(path => path.startsWith('images/'))).toBe(true)
    const css = entry.files.get('theme.css')!.toString()
    expect(css).not.toMatch(/url\(["']?\/(fonts|theme\/images)\//)
    expect(css).toContain(`/_t/${result.digest}/fonts/`)
    expect(css).toMatch(/@layer myc\.settings/)
    expect(css).toMatch(/@layer myc\.theme/)
    expect(css).toMatch(/@layer myc\.components/)
  })

  it('compiles the starter and writes runtime.json with everything the server reads', async () => {
    const store = scratch()
    const result = await installTheme({ kind: 'folder', dir: join(ROOT, 'themes/starter') }, options(store, { allowCode: true }))
    const runtime = JSON.parse((await loadEntry(store, result.digest))!.files.get('runtime.json')!.toString()) as { images: Record<string, string>, fonts: Array<{ url: string }>, layout: Record<string, string>, display: { family: string }, palette: { modes: object }, messages: object } & Record<string, unknown>
    expect(runtime).toMatchObject({ id: 'starter', version: '0.1.0', digest: result.digest, packageDigest: result.packageDigest, contract: '2.0', code: true })
    expect(runtime.images.favicon).toBe(`/_t/${result.digest}/images/favicon.svg`)
    expect(runtime.fonts[0]?.url).toBe(`/_t/${result.digest}/fonts/fraunces-latin-var.woff2`)
    expect(runtime.layout.header).toBe('centered')
    expect(runtime.display.family).toBeTypeOf('string')
    expect(Object.keys(runtime.palette.modes)).toEqual(['light', 'dark'])
    expect(Object.keys(runtime.messages).sort()).toEqual(['en', 'es'])
    expect(JSON.stringify(runtime.messages)).not.toContain('<script')
  })

  it('compiles a data-only theme and refuses a code theme unless the build allows it', async () => {
    const store = scratch()
    const result = await installTheme({ kind: 'folder', dir: dataOnly() }, options(store))
    expect(result.manifest.code).toBe(false)
    const refused = await failure(installTheme({ kind: 'folder', dir: join(ROOT, 'themes/starter') }, options(scratch())))
    expect(refused.rule).toBe('code')
    expect(refused.message).toContain('starter')
  })

  it('gives identical bytes when it installs twice, in the same store and in another one', async () => {
    const dir = dataOnly()
    const [first, second] = [scratch(), scratch()]
    const a = await installTheme({ kind: 'folder', dir }, options(first))
    const again = await installTheme({ kind: 'folder', dir }, options(first))
    const b = await installTheme({ kind: 'folder', dir }, options(second))
    expect(again.created).toBe(false)
    expect(again.digest).toBe(a.digest)
    expect(snapshot(first)).toEqual(snapshot(second))
    expect(a.manifest).toEqual(b.manifest)
  })

  it('gives another digest for another core build, and the same package digest', async () => {
    const dir = dataOnly()
    const store = scratch()
    const a = await installTheme({ kind: 'folder', dir }, options(store, { coreBuild: 'build-1' }))
    const b = await installTheme({ kind: 'folder', dir }, options(store, { coreBuild: 'build-2' }))
    expect(b.digest).not.toBe(a.digest)
    expect(b.packageDigest).toBe(a.packageDigest)
    expect(compileKey('build-1')).not.toBe(compileKey('build-2'))
  })
})

describe('what never reaches the store', () => {
  async function rejects(edit: (dir: string) => void, rule: InstallRule, mention: string): Promise<void> {
    const dir = dataOnly()
    edit(dir)
    const store = scratch()
    const error = await failure(installTheme({ kind: 'folder', dir }, options(store)))
    expect(error.rule).toBe(rule)
    expect(error.message).toContain(mention)
    expect(error.message).toContain('starter')
    expect(error.message).not.toContain(dir)
    expect(listAll(join(store, 'v1/entries'))).toEqual([])
  }
  const append = (dir: string, file: string, text: string): void => writeFileSync(join(dir, file), `${readFileSync(join(dir, file), 'utf8')}\n${text}\n`)

  it('rejects a remote url()', () => rejects(dir => append(dir, 'theme.css', '.x { background: url(https://example.com/a.png) }'), 'validation', 'https://example.com/a.png'))
  it('rejects a selector that is not a public hook', () => rejects(dir => append(dir, 'theme.css', '.myc-not-a-hook { color: red }'), 'validation', 'myc-not-a-hook'))
  it('rejects a url() outside fonts/ and images/', () => rejects(dir => append(dir, 'theme.css', '.x { background: url(/api/secret) }'), 'validation', '/api/secret'))
  it('rejects messages outside the theme namespace', () => rejects(dir => writeFileSync(join(dir, 'i18n/en.json'), '{"nav":{"home":"Home"}}'), 'messages', '"nav"'))
  it('rejects a message with a prototype key', () => rejects(dir => writeFileSync(join(dir, 'i18n/en.json'), '{"theme":{"__proto__":{"x":"y"}}}'), 'messages', '__proto__'))
  it('rejects a message that does not compile', () => rejects(dir => writeFileSync(join(dir, 'i18n/en.json'), '{"theme":{"a":"Hello {name"}}'), 'messages', 'theme.a'))

  it('rejects a symlink in the folder', async () => {
    const dir = dataOnly()
    symlinkSync('/etc/hostname', join(dir, 'fonts/link.txt'))
    expect((await failure(installTheme({ kind: 'folder', dir }, options(scratch())))).rule).toBe('source')
  })

  it('rejects a folder without theme.json', async () => {
    const dir = scratch()
    writeFileSync(join(dir, 'a.txt'), 'x')
    expect((await failure(installTheme({ kind: 'folder', dir }, options(scratch())))).rule).toBe('source')
  })
})

describe('admission checks', () => {
  it('runs contrast and budgets on every install, and skips them only for the image build', async () => {
    const dir = join(scratch(), 'low-contrast')
    cpSync(join(ROOT, 'test/fixtures/themes/low-contrast'), dir, { recursive: true })
    const error = await failure(installTheme({ kind: 'folder', dir }, options(scratch())))
    expect(error.rule).toBe('validation')
    expect(error.message).toContain('needs 4.5:1')
    const result = await installTheme({ kind: 'folder', dir }, options(scratch(), { buildChecksOnly: true }))
    expect(result.created).toBe(true)
    expect(result.manifest.contract).toMatch(/^\d+\.\d+$/)
  })

  it('still refuses a contract or a hook problem when the image build skips admission', async () => {
    const dir = dataOnly()
    writeFileSync(join(dir, 'theme.css'), '.myc-not-a-hook { color: red }')
    expect((await failure(installTheme({ kind: 'folder', dir }, options(scratch(), { buildChecksOnly: true })))).rule).toBe('validation')
  })
})

describe('installing a package', () => {
  function packageOf(dir: string): { data: Buffer, pin: { id: string, version: string, digest: string } } {
    const built = buildPackage(discoverThemes([dir])[0]!, HOOKS)
    return { data: built.tgz, pin: { id: built.manifest.id, version: built.manifest.version, digest: built.digest } }
  }

  it('unpacks against the pin, installs, and counts as installed only with the package kept', async () => {
    const store = scratch()
    const { data, pin } = packageOf(dataOnly())
    const result = await installTheme({ kind: 'package', data, pin, attestation: Buffer.from('{"bundle":true}') }, options(store))
    expect(result.packageDigest).toBe(pin.digest)
    const entry = await installedEntry(store, pin, 'test-build')
    expect(entry?.manifest.digest).toBe(result.digest)
    expect(await installedEntry(store, pin, 'another-build')).toBeNull()
    expect(await installedEntry(store, { ...pin, digest: `sha256:${'0'.repeat(64)}` }, 'test-build')).toBeNull()
    let seen = ''
    await installedEntry(store, pin, 'test-build', (bundle) => {
      seen = Buffer.from(bundle).toString()
    })
    expect(seen).toBe('{"bundle":true}')
    expect(await installedEntry(store, pin, 'test-build', () => {
      throw new Error('bad bundle')
    })).toBeNull()
  })

  it('does not treat a planted entry with a matching manifest as installed', async () => {
    const store = scratch()
    const { data, pin } = packageOf(dataOnly())
    const result = await installTheme({ kind: 'package', data, pin }, options(store))
    const planted = scratch()
    mkdirSync(join(planted, 'v1/entries'), { recursive: true })
    cpSync(join(store, 'v1/entries', result.digest), join(planted, 'v1/entries', result.digest), { recursive: true })
    expect(await loadEntry(planted, result.digest)).not.toBeNull()
    expect(await installedEntry(planted, pin, 'test-build')).toBeNull()
    // The kept package is hashed again: a different file under the digest does not count
    mkdirSync(join(planted, 'v1/packages', pin.digest.slice(7)), { recursive: true })
    writeFileSync(join(planted, 'v1/packages', pin.digest.slice(7), 'package.tgz'), 'not the package')
    expect(await installedEntry(planted, pin, 'test-build')).toBeNull()
  })

  it('refuses a package that is not the pinned one, and an invalid pin, before touching the store', async () => {
    const store = scratch()
    const { data, pin } = packageOf(dataOnly())
    expect((await failure(installTheme({ kind: 'package', data, pin: { ...pin, digest: `sha256:${'1'.repeat(64)}` } }, options(store)))).rule).toBe('package')
    expect((await failure(installTheme({ kind: 'package', data, pin: { ...pin, id: '../x' } }, options(store)))).rule).toBe('pin')
    expect((await failure(installTheme({ kind: 'package', data, pin: { ...pin, id: 'other' } }, options(store)))).rule).toBe('identity')
    expect(existsSync(join(store, 'v1/entries'))).toBe(false)
  })

  it('refuses a code package unless the build allows code', async () => {
    const built = buildPackage(discoverThemes([join(ROOT, 'themes/starter')])[0]!, HOOKS)
    const pin = { id: 'starter', version: built.manifest.version, digest: built.digest }
    expect((await failure(installTheme({ kind: 'package', data: built.tgz, pin }, options(scratch())))).rule).toBe('code')
    const result = await installTheme({ kind: 'package', data: built.tgz, pin }, options(scratch(), { allowCode: true }))
    expect(result.manifest.code).toBe(true)
  })

  it('leaves no source folder behind', async () => {
    const store = scratch()
    const { data, pin } = packageOf(dataOnly())
    await installTheme({ kind: 'package', data, pin }, options(store))
    expect(readdirSync(join(store, 'v1/.tmp'))).toEqual([])
  })
})

describe('the store', () => {
  async function installed(): Promise<{ store: string, digest: string }> {
    const store = scratch()
    const result = await installTheme({ kind: 'folder', dir: dataOnly() }, options(store))
    return { store, digest: result.digest }
  }

  it('leaves no partial entry when a write is interrupted', async () => {
    const store = scratch()
    const files = new Map([['theme.css', Buffer.from('a{}')], ['../escape.css', Buffer.from('b{}')]])
    const digest = 'a'.repeat(64)
    const manifest = { storeVersion: 1, id: 'x', version: '1.0.0', digest, packageDigest: `sha256:${'b'.repeat(64)}`, compileKey: 'k', contract: '2.0', code: false, origin: 'folder' as const, files: {} }
    await expect(writeEntry(store, manifest, files)).rejects.toMatchObject({ rule: 'store' })
    expect(await loadEntry(store, digest)).toBeNull()
    expect(listAll(join(store, 'v1/entries'))).toEqual([])
    expect(listAll(join(store, 'v1/.tmp'))).toEqual([])
  })

  it('refuses a changed, a missing and an extra file', async () => {
    const { store, digest } = await installed()
    const dir = join(store, 'v1/entries', digest)
    writeFileSync(join(dir, 'theme.css'), 'a{color:red}')
    await expect(loadEntry(store, digest)).rejects.toMatchObject({ rule: 'integrity' })
    const second = await installed()
    rmSync(join(second.store, 'v1/entries', second.digest, 'runtime.json'))
    await expect(loadEntry(second.store, second.digest)).rejects.toMatchObject({ rule: 'integrity' })
    const third = await installed()
    writeFileSync(join(third.store, 'v1/entries', third.digest, 'extra.js'), 'x')
    await expect(loadEntry(third.store, third.digest)).rejects.toMatchObject({ rule: 'integrity' })
  })

  it('replaces an entry that fails its manifest when the theme is installed again', async () => {
    const { store, digest } = await installed()
    writeFileSync(join(store, 'v1/entries', digest, 'theme.css'), 'tampered')
    const again = await installTheme({ kind: 'folder', dir: dataOnly() }, options(store))
    expect(again.digest).toBe(digest)
    expect(again.created).toBe(true)
    expect(await loadEntry(store, digest)).not.toBeNull()
  })

  it('answers null for a digest that is not there and refuses a malformed one', async () => {
    const store = scratch()
    expect(await loadEntry(store, 'c'.repeat(64))).toBeNull()
    await expect(loadEntry(store, '../../etc')).rejects.toMatchObject({ rule: 'store' })
  })

  it('lets one install per digest run at a time, and takes a lock whose lease ran out', async () => {
    const store = scratch()
    const digest = 'd'.repeat(64)
    mkdirSync(join(store, 'v1/.tmp'), { recursive: true })
    const lock = join(store, 'v1/.tmp', `lock-${digest}.json`)
    const manifest = { storeVersion: 1, id: 'x', version: '1.0.0', digest, packageDigest: `sha256:${'b'.repeat(64)}`, compileKey: 'k', contract: '2.0', code: false, origin: 'folder' as const, files: {} }
    writeFileSync(lock, JSON.stringify({ owner: 'someone', expires: Date.now() + 60_000 }))
    await expect(writeEntry(store, manifest, new Map())).rejects.toMatchObject({ rule: 'busy' })
    writeFileSync(lock, JSON.stringify({ owner: 'someone', expires: Date.now() - 1 }))
    await expect(writeEntry(store, manifest, new Map())).resolves.toEqual({ created: true })
    expect(existsSync(lock)).toBe(false)
  })

  it('cleans staging folders and expired locks at boot, and keeps a live lock', async () => {
    const store = scratch()
    const tmp = join(store, 'v1/.tmp')
    mkdirSync(join(tmp, 'entry-abc'), { recursive: true })
    writeFileSync(join(tmp, 'entry-abc/theme.css'), 'x')
    writeFileSync(join(tmp, 'lock-old.json'), JSON.stringify({ expires: 1 }))
    writeFileSync(join(tmp, 'lock-live.json'), JSON.stringify({ expires: Date.now() + 60_000 }))
    await cleanTemporary(store)
    expect(readdirSync(tmp)).toEqual(['lock-live.json'])
  })
})

describe('outside Nuxt', () => {
  function imports(file: string, seen = new Set<string>()): Set<string> {
    if (seen.has(file)) return seen
    seen.add(file)
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/^(?:import(?!\s+type\b)|export)\s[^'"]*?from\s+'([^']+)'/gm)) {
      if (!specifier!.startsWith('.')) seen.add(specifier!)
      else for (const extension of ['', '.ts', '.mjs', '/index.ts']) {
        const target = resolve(join(file, '..'), specifier! + extension)
        if (existsSync(target) && /\.(ts|mjs)$/.test(target)) imports(target, seen)
      }
    }
    return seen
  }

  it('imports nothing of Nuxt, directly or through the modules it uses', () => {
    const all = [...imports(join(ROOT, 'modules/theme/install/install.ts'))]
    expect(all.filter(name => name === 'nuxt' || name.startsWith('nuxt/') || name.startsWith('@nuxt/') || name === 'nitropack')).toEqual([])
  })

  it('runs in a plain Node process', () => {
    const store = scratch()
    const script = join(scratch(), 'install.mjs')
    writeFileSync(script, `
      import { installTheme } from ${JSON.stringify(join(ROOT, 'modules/theme/install/install.ts'))}
      import { loadHooks } from ${JSON.stringify(join(ROOT, 'modules/theme/hooks.ts'))}
      const hooks = loadHooks(${JSON.stringify(join(ROOT, 'app'))})
      const result = await installTheme({ kind: 'folder', dir: ${JSON.stringify(join(ROOT, 'themes/starter'))} }, { storeDir: ${JSON.stringify(store)}, hooks, coreBuild: 'plain', allowCode: true })
      console.log(result.digest)
    `)
    const out = execFileSync(process.execPath, [join(ROOT, 'node_modules/jiti/lib/jiti-cli.mjs'), script], { encoding: 'utf8', cwd: scratch() })
    expect(out.trim()).toMatch(/^[0-9a-f]{64}$/)
  })
})
