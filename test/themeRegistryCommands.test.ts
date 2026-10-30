import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRegistry } from '../modules/theme/registry/client'
import { addTheme, outdatedThemes, pullThemes } from '../modules/theme/registry/commands'
import type { RegistryContext } from '../modules/theme/registry/commands'
import { RegistryError } from '../modules/theme/registry/error'
import { DEFAULT_REGISTRY, THEME_DIGEST } from '../modules/theme/registry/constants'
import { formatLock, parseLock, readLock, writeLock } from '../modules/theme/registry/lock'
import { DEFAULT_THEME, discoverThemes, selectTheme, themeRoots } from '../modules/theme/themes'
import { digestOf, startRegistry, stubVerifier, TEST_IDENTITY } from './fixtures/registry'
import type { FakeRegistry } from './fixtures/registry'
import { packageOf } from './fixtures/tar'

const ROOT = process.cwd()
const started: FakeRegistry[] = []
const dirs: string[] = []

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-pull-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(started.splice(0).map(fake => fake.close()))
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A theme package for `id@version`; `slots/` makes it a code package. */
function theme(id: string, version: string, fields: Record<string, unknown> = {}, files: Record<string, string> = {}): Buffer {
  return packageOf({ 'theme.json': JSON.stringify({ id, name: id, version, contract: 2, ...fields }), 'theme.css': `.${id}{}`, ...files })
}

function entry(digest: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
  return { digest, contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false, ...fields }
}

async function failure(run: () => Promise<unknown>): Promise<RegistryError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof RegistryError) return error
    throw error
  }
  throw new Error('expected a RegistryError')
}

interface Setup {
  fake: FakeRegistry
  context: RegistryContext
  lines: string[]
  root: string
  cache: string
}

async function setup(versions: Record<string, Buffer> = { '1.0.0': theme('sample', '1.0.0'), '1.1.0': theme('sample', '1.1.0') }, fields: Record<string, Record<string, unknown>> = {}): Promise<Setup> {
  const fake = await startRegistry()
  started.push(fake)
  const index: Record<string, unknown> = {}
  for (const [version, data] of Object.entries(versions)) index[version] = entry(fake.publish('sample', version, data), fields[version])
  fake.publishIndex({ version: 1, themes: { sample: { versions: index } } })
  const root = temp()
  const cache = temp()
  const lines: string[] = []
  const context: RegistryContext = { root, registry: fake.registry, registryFor: registry => createRegistry({ registry, identity: TEST_IDENTITY, verifier: stubVerifier }), cacheDir: cache, log: line => lines.push(line) }
  return { fake, context, lines, root, cache }
}

describe('theme:add', () => {
  it('resolves a range, verifies the package and writes the lock entry', async () => {
    const { context, root, cache, fake } = await setup()
    const { id, entry: written } = await addTheme(context, 'sample@^1.0.0')
    expect(id).toBe('sample')
    expect(written).toEqual({ version: '1.1.0', digest: digestOf(theme('sample', '1.1.0')), contract: '2.0', tier: 'official', distribution: 'public', registry: fake.registry, code: false })
    expect(readLock(root).sample).toEqual(written)
    expect(readdirSync(cache).map(name => name.slice(64)).sort()).toEqual(['.sigstore.json', '.tgz'])
    expect(existsSync(join(root, '.micelio'))).toBe(false)
  })

  it('skips a yanked version', async () => {
    const { context } = await setup(undefined, { '1.1.0': { status: 'yanked' } })
    expect((await addTheme(context, 'sample')).entry.version).toBe('1.0.0')
  })

  it('records that a package has code', async () => {
    const { context } = await setup({ '1.0.0': theme('sample', '1.0.0', {}, { 'slots/ThemeMark.vue': '<template />' }) }, { '1.0.0': { code: true } })
    expect((await addTheme(context, 'sample')).entry.code).toBe(true)
  })

  it('refuses an index that disagrees with the package about code, and writes nothing', async () => {
    const { context, root } = await setup({ '1.0.0': theme('sample', '1.0.0', {}, { 'slots/ThemeMark.vue': '<template />' }) })
    expect((await failure(() => addTheme(context, 'sample'))).failure).toBe('lock')
    expect(existsSync(join(root, 'themes.lock.json'))).toBe(false)
  })

  it('refuses a package that is not the theme the index says, or declares a newer contract', async () => {
    const other = await setup({ '1.0.0': theme('other', '1.0.0') })
    expect((await failure(() => addTheme(other.context, 'sample'))).failure).toBe('identity')
    const newer = await setup({ '1.0.0': theme('sample', '1.0.0', { contract: '2.1' }) })
    expect((await failure(() => addTheme(newer.context, 'sample'))).failure).toBe('contract')
  })

  it('refuses bytes that do not match the digest of the index', async () => {
    const { context, fake, root } = await setup()
    fake.tamper(digestOf(theme('sample', '1.1.0')), theme('sample', '1.1.0', { name: 'evil' }))
    expect((await failure(() => addTheme(context, 'sample'))).failure).toBe('digest')
    expect(existsSync(join(root, 'themes.lock.json'))).toBe(false)
  })

  it('adds a local package as a file entry that theme:pull --frozen installs', async () => {
    const { context, root } = await setup()
    const data = theme('local-one', '0.2.0', {}, { 'slots/ThemeMark.vue': '<template />' })
    writeFileSync(join(root, 'local-one-0.2.0.tgz'), data)
    const { entry: written } = await addTheme(context, './local-one-0.2.0.tgz')
    expect(written).toEqual({ version: '0.2.0', digest: digestOf(data), contract: '2.0', tier: 'local', distribution: 'file', registry: null, code: true })
    const pulled = await pullThemes(context, { frozen: true })
    expect(pulled.map(item => item.id)).toEqual(['local-one'])
    expect(readFileSync(join(root, '.micelio/themes/local-one/theme.css'), 'utf8')).toBe('.local-one{}')
  })

  it('refuses a local file that is not a valid package or is too large', async () => {
    const { context, root } = await setup()
    writeFileSync(join(root, 'bad.tgz'), 'not gzip')
    await expect(addTheme(context, './bad.tgz')).rejects.toThrow(/gzip|ratio|tar/)
    writeFileSync(join(root, 'big.tgz'), Buffer.alloc(2 * 1024 * 1024 + 1))
    expect((await failure(() => addTheme(context, './big.tgz'))).failure).toBe('size')
    expect(existsSync(join(root, 'themes.lock.json'))).toBe(false)
  })

  it('refuses a spec with two @', async () => {
    const { context } = await setup()
    expect((await failure(() => addTheme(context, 'sample@1@2'))).failure).toBe('pin')
  })

  it('names the theme when it is not in the registry', async () => {
    const { context } = await setup()
    expect((await failure(() => addTheme(context, 'missing'))).message).toContain('missing')
  })
})

describe('theme:pull', () => {
  it('installs a locked theme into .micelio/themes and then works offline from the cache', async () => {
    const { context, root, fake, lines } = await setup()
    await addTheme(context, 'sample@1.0.0')
    rmSync(join(root, '.micelio'), { recursive: true, force: true })
    const first = await pullThemes(context)
    expect(first[0]).toMatchObject({ id: 'sample', version: '1.0.0', cached: true })
    expect(readFileSync(join(root, '.micelio/themes/sample/theme.css'), 'utf8')).toBe('.sample{}')

    rmSync(join(context.cacheDir), { recursive: true, force: true })
    expect((await pullThemes(context))[0]?.cached).toBe(false)
    await fake.close()
    expect((await pullThemes(context))[0]?.cached).toBe(true)
    expect(lines.at(-1)).toContain('(cache)')
  })

  it('verifies the kept attestation on a cache hit, and asks the registry when it does not verify', async () => {
    const { context, fake } = await setup()
    const { entry: written } = await addTheme(context, 'sample@1.0.0')
    const bundle = join(context.cacheDir, `${written.digest.slice(7)}.sigstore.json`)
    writeFileSync(bundle, '{"stub":true,"signer":"someone else","hex":"0"}')
    expect((await pullThemes(context))[0]?.cached).toBe(false)
    expect(readFileSync(bundle, 'utf8')).toContain(TEST_IDENTITY.packages)

    rmSync(bundle)
    expect((await pullThemes(context))[0]?.cached).toBe(false)
    await fake.close()
    writeFileSync(bundle, '{"stub":true,"signer":"someone else","hex":"0"}')
    expect((await failure(() => pullThemes(context))).failure).toBe('network')
  })

  it('pulls a yanked version from an existing lock', async () => {
    const { context, fake } = await setup()
    await addTheme(context, 'sample@1.0.0')
    rmSync(context.cacheDir, { recursive: true, force: true })
    fake.publishIndex({ version: 1, themes: { sample: { versions: { '1.0.0': entry(digestOf(theme('sample', '1.0.0')), { status: 'yanked' }) } } } })
    expect((await failure(() => addTheme(context, 'sample@1.0.0'))).failure).toBe('not-found')
    expect((await pullThemes(context, { frozen: true }))[0]?.version).toBe('1.0.0')
  })

  it('refuses bytes whose digest is not the locked one, naming theme, version and digest', async () => {
    const { context, fake } = await setup()
    const { entry: written } = await addTheme(context, 'sample@1.0.0')
    rmSync(context.cacheDir, { recursive: true, force: true })
    fake.tamper(written.digest, theme('sample', '1.0.0', { name: 'evil' }))
    const error = await failure(() => pullThemes(context))
    expect(error.failure).toBe('digest')
    expect(error.message).toContain('sample@1.0.0')
    expect(error.message).toContain(written.digest)
  })

  it('reads the package from the registry the entry was resolved against, not the configured one', async () => {
    const { context } = await setup()
    await addTheme(context, 'sample@1.0.0')
    rmSync(context.cacheDir, { recursive: true, force: true })
    const elsewhere = { ...context, registry: 'registry.example.test/other' }
    expect((await pullThemes(elsewhere))[0]?.cached).toBe(false)
  })

  it('fails on a file entry whose package is not in the cache', async () => {
    const { context, root } = await setup()
    writeFileSync(join(root, 'a.tgz'), theme('local-one', '0.2.0'))
    await addTheme(context, './a.tgz')
    rmSync(context.cacheDir, { recursive: true, force: true })
    expect((await failure(() => pullThemes(context))).failure).toBe('not-found')
  })

  it('does not install a licensed entry', async () => {
    const { context, root } = await setup()
    writeLock(root, { paid: { version: '1.0.0', digest: `sha256:${'a'.repeat(64)}`, contract: '2.0', tier: 'official', distribution: 'licensed', registry: context.registry, code: false } })
    expect((await failure(() => pullThemes(context))).failure).toBe('unsupported')
  })

  it('removes installed themes that are no longer in the lock', async () => {
    const { context, root } = await setup()
    await addTheme(context, 'sample@1.0.0')
    mkdirSync(join(root, '.micelio/themes/old'), { recursive: true })
    mkdirSync(join(root, '.micelio/themes/.sample.dead.tmp'), { recursive: true })
    await pullThemes(context)
    expect(readdirSync(join(root, '.micelio/themes'))).toEqual(['sample'])
  })

  it('does nothing for an empty or missing lock', async () => {
    const { context } = await setup()
    expect(await pullThemes(context)).toEqual([])
  })
})

describe('theme:pull --frozen', () => {
  it('fails without a lock', async () => {
    const { context } = await setup()
    const error = await failure(() => pullThemes(context, { frozen: true }))
    expect(error.failure).toBe('lock')
    expect(error.message).toContain('themes.lock.json')
  })

  it('fails when the lock is not in the form theme:add writes', async () => {
    const { context, root } = await setup()
    await addTheme(context, 'sample@1.0.0')
    const file = join(root, 'themes.lock.json')
    writeFileSync(file, JSON.stringify(JSON.parse(readFileSync(file, 'utf8')) as object))
    expect((await failure(() => pullThemes(context, { frozen: true }))).message).toContain('not in the form')
    expect(readFileSync(file, 'utf8').endsWith('\n')).toBe(false)
  })

  it('fails when the lock disagrees with the package, and a plain pull corrects the record', async () => {
    const { context, root } = await setup()
    await addTheme(context, 'sample@1.0.0')
    const lock = readLock(root)
    writeLock(root, { sample: { ...(lock.sample as NonNullable<typeof lock.sample>), code: true } })
    expect((await failure(() => pullThemes(context, { frozen: true }))).failure).toBe('lock')
    await pullThemes(context)
    expect(readLock(root).sample?.code).toBe(false)
    expect(readFileSync(join(root, 'themes.lock.json'), 'utf8')).toBe(formatLock(readLock(root)))
    await expect(pullThemes(context, { frozen: true })).resolves.toHaveLength(1)
  })

  it('fails when a locked version is gone from the registry', async () => {
    const { context } = await setup()
    await addTheme(context, 'sample@1.0.0')
    rmSync(context.cacheDir, { recursive: true, force: true })
    const gone = { ...context, registryFor: () => createRegistry({ registry: context.registry.replace(/\/[^/]+$/, '/nowhere'), identity: TEST_IDENTITY, verifier: stubVerifier }) }
    expect((await failure(() => pullThemes(gone, { frozen: true }))).failure).toBe('not-found')
  })
})

describe('theme:outdated', () => {
  it('lists newer compatible versions of the locked themes', async () => {
    const { context } = await setup({ '1.0.0': theme('sample', '1.0.0'), '1.1.0': theme('sample', '1.1.0'), '1.2.0': theme('sample', '1.2.0') }, { '1.2.0': { status: 'yanked' } })
    await addTheme(context, 'sample@1.0.0')
    expect(await outdatedThemes(context)).toEqual([{ id: 'sample', current: '1.0.0', newer: ['1.1.0'] }])
    await addTheme(context, 'sample@1.1.0')
    expect(await outdatedThemes(context)).toEqual([])
  })
})

describe('discovering pulled themes', () => {
  function install(root: string, where: string, id: string): void {
    mkdirSync(join(root, where, id), { recursive: true })
    writeFileSync(join(root, where, id, 'theme.json'), JSON.stringify({ id, name: id }))
  }

  it('scans .micelio/themes after themes/ and before MICELIO_THEME_DIRS', () => {
    expect(themeRoots('/r', '/x:/y')).toEqual(['/r/themes', '/r/.micelio/themes', '/x', '/y'])
  })

  it('finds a pulled theme', () => {
    const root = temp()
    install(root, '.micelio/themes', 'pulled')
    expect(discoverThemes(themeRoots(root, '')).map(item => item.id)).toEqual(['pulled'])
  })

  it('uses the local theme over the locked one and says so', () => {
    const root = temp()
    install(root, '.micelio/themes', 'both')
    install(root, 'themes', 'both')
    vi.stubEnv('CI', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const found = discoverThemes(themeRoots(root, ''))
    expect(found.map(item => item.dir)).toEqual([join(root, 'themes/both')])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using the local one'))
    vi.unstubAllEnvs()
  })

  it('fails in CI when a theme is both local and locked', () => {
    const root = temp()
    install(root, '.micelio/themes', 'both')
    install(root, 'themes', 'both')
    vi.stubEnv('CI', 'true')
    expect(() => discoverThemes(themeRoots(root, ''))).toThrow(/uses only the locked one/)
    vi.unstubAllEnvs()
  })

  it('ignores folders that start with a dot, such as an interrupted install', () => {
    const root = temp()
    install(root, '.micelio/themes', '.sample.abc.tmp')
    expect(discoverThemes(themeRoots(root, ''))).toEqual([])
  })

  it('still refuses two local copies of one theme', () => {
    const root = temp()
    install(root, 'themes', 'twice')
    install(root, 'more', 'twice')
    expect(() => discoverThemes([join(root, 'themes'), join(root, 'more')])).toThrow(/installed twice/)
  })

  it('points a missing theme at theme:add and theme:pull', () => {
    expect(() => selectTheme([], 'x')).toThrow(/theme:add -- x.*theme:pull/)
  })
})

describe('the commands', () => {
  function run(script: string, ...args: string[]): ReturnType<typeof spawnSync> {
    return spawnSync(join(ROOT, 'node_modules/.bin/jiti'), [join(ROOT, 'scripts', script), ...args], { encoding: 'utf8', cwd: ROOT })
  }

  it('pins the default theme in the lock of the repository, in the form theme:add writes', () => {
    const text = readFileSync(join(ROOT, 'themes.lock.json'), 'utf8')
    expect(text).toBe(formatLock(parseLock(text)))
    expect(readLock(ROOT)[DEFAULT_THEME]).toMatchObject({ version: expect.stringMatching(/^\d+\.\d+\.\d+$/), digest: expect.stringMatching(THEME_DIGEST), tier: 'official', distribution: 'public', registry: DEFAULT_REGISTRY, code: true })
  })

  it('theme:add prints the usage without a spec', () => {
    const result = run('theme-add.ts')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Usage: npm run theme:add')
  })
})
