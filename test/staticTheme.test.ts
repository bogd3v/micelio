import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadDefaultTheme } from '../server/lib/builtInStore'
import type { ThemeSwitch } from '../server/lib/themeSwitch/types'
import { createRegistry } from '../modules/theme/registry/client'
import type { BuiltInIndex } from '../modules/theme/install/types'
import { adoptResolvedTheme, copyPublishedFiles, readLiveDigest, readNamedTheme, resolveStaticTheme, settleStaticTheme, StaticThemeError } from '../modules/theme/static-theme'
import { startRegistry, stubVerifier, TEST_IDENTITY } from './fixtures/registry'
import type { FakeRegistry } from './fixtures/registry'
import { builtInStore, cleanup, packaged, publishAll, rig, scratch, STARTER_PINNED } from './fixtures/themeSwitch'

// The registry client the static build makes goes through boot.ts; the stand-in verifier takes the place of Sigstore (themeAttestation.test.ts verifies a real bundle)
const created = vi.hoisted(() => ({ options: [] as Array<{ core?: string }> }))
vi.mock('../modules/theme/registry/client', async (original) => {
  const actual = await original<typeof import('../modules/theme/registry/client')>()
  return {
    ...actual,
    createRegistry: (options: { core?: string, verifier?: unknown }) => {
      created.options.push(options)
      return (actual.createRegistry as (options: unknown) => unknown)({ verifier: stubVerifier, ...options })
    },
  }
})

const fakes: FakeRegistry[] = []
const strapis: Server[] = []

afterEach(async () => {
  created.options.length = 0
  await Promise.all(fakes.splice(0).map(fake => fake.close()))
  await Promise.all(strapis.splice(0).map(server => new Promise<void>((done) => {
    server.closeAllConnections()
    server.close(() => done())
  })))
  cleanup()
})

async function registry(): Promise<FakeRegistry> {
  const fake = await startRegistry()
  fakes.push(fake)
  return fake
}

/** A Strapi that answers every request with `answer`, and records what it was asked. */
async function strapi(answer: (url: URL) => { status: number, body: unknown }): Promise<{ url: string, asked: Array<{ url: URL, authorization: string | undefined }> }> {
  const asked: Array<{ url: URL, authorization: string | undefined }> = []
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    asked.push({ url, authorization: request.headers.authorization })
    const { status, body } = answer(url)
    response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
  })
  strapis.push(server)
  await new Promise<void>(listening => server.listen(0, '127.0.0.1', listening))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, asked }
}

const withTheme = (theme: unknown): (() => { status: number, body: unknown }) => () => ({ status: 200, body: { data: { theme } } })

/** The message of the `StaticThemeError` a promise rejects with. */
async function refused(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(StaticThemeError)
    return (error as Error).message
  }
  throw new Error('expected the promise to reject')
}

describe('readNamedTheme', () => {
  it('reads the theme component of the default language with the build token, and nothing else of the site', async () => {
    const cms = await strapi(withTheme({ id: 1, themeId: 'sample', themeVersion: '1.0.0', themeDigest: `sha256:${'a'.repeat(64)}`, defaultMode: 'dia' }))
    const named = await readNamedTheme({ strapiUrl: cms.url, strapiApiToken: 'build-token' })
    expect(named).toEqual({ themeId: 'sample', themeVersion: '1.0.0', themeDigest: `sha256:${'a'.repeat(64)}` })
    expect(cms.asked).toHaveLength(1)
    expect(cms.asked[0]?.authorization).toBe('Bearer build-token')
    expect(cms.asked[0]?.url.pathname).toBe('/api/site-setting')
    expect(cms.asked[0]?.url.searchParams.get('locale')).toBe('en')
    expect(cms.asked[0]?.url.searchParams.get('populate[theme][populate]')).toBe('*')
    expect([...cms.asked[0]!.url.searchParams.keys()].sort()).toEqual(['locale', 'populate[theme][populate]'])
  })

  it('names nothing when the field is null or empty, the theme component is absent, or the site has no settings yet', async () => {
    expect(await readNamedTheme({ strapiUrl: (await strapi(withTheme({ themeId: null, themeVersion: null, themeDigest: null }))).url, strapiApiToken: 't' })).toEqual({})
    expect(await readNamedTheme({ strapiUrl: (await strapi(withTheme(null))).url, strapiApiToken: 't' })).toEqual({})
    expect(await readNamedTheme({ strapiUrl: (await strapi(() => ({ status: 200, body: { data: {} } }))).url, strapiApiToken: 't' })).toEqual({})
    expect(await readNamedTheme({ strapiUrl: (await strapi(() => ({ status: 404, body: {} }))).url, strapiApiToken: 't' })).toEqual({})
  })

  it('fails, rather than naming no theme, when Strapi cannot be read: the default theme must not replace the one the editor chose', async () => {
    const down = await strapi(() => ({ status: 503, body: {} }))
    expect(await refused(readNamedTheme({ strapiUrl: down.url, strapiApiToken: 't' }))).toContain('HTTP 503')
    const forbidden = await strapi(() => ({ status: 403, body: {} }))
    expect(await refused(readNamedTheme({ strapiUrl: forbidden.url, strapiApiToken: 't' }))).toContain('HTTP 403')
    // Nothing listens on port 1
    expect(await refused(readNamedTheme({ strapiUrl: 'http://127.0.0.1:1', strapiApiToken: 't' }))).toContain('could not be read from Strapi')
  })

  it('fails when Strapi answers something that is not the site settings (a proxy\'s page), and keeps `data: null` as a site with no settings yet', async () => {
    expect(await refused(readNamedTheme({ strapiUrl: (await strapi(() => ({ status: 200, body: {} }))).url, strapiApiToken: 't' }))).toContain('did not answer with the site settings')
    expect(await refused(readNamedTheme({ strapiUrl: (await strapi(() => ({ status: 200, body: { data: '<html>' } }))).url, strapiApiToken: 't' }))).toContain('did not answer with the site settings')
    expect(await readNamedTheme({ strapiUrl: (await strapi(() => ({ status: 200, body: { data: null } }))).url, strapiApiToken: 't' })).toEqual({})
  })

  it('names the error code, and not the address of the CMS, when the request has no status', async () => {
    const message = await refused(readNamedTheme({ strapiUrl: 'http://127.0.0.1:1', strapiApiToken: 't' }))
    expect(message).not.toContain('127.0.0.1')
    expect(message).not.toContain('site-setting')
  })

  it('fails for a value that is not a string, since dropping it would publish the default theme', async () => {
    expect(await refused(readNamedTheme({ strapiUrl: (await strapi(withTheme({ themeId: 5 }))).url, strapiApiToken: 't' }))).toContain('site-setting.theme.themeId is not a string')
    expect(await refused(readNamedTheme({ strapiUrl: (await strapi(withTheme('starter'))).url, strapiApiToken: 't' }))).toContain('is not an object')
  })
})

describe('settleStaticTheme', () => {
  it('uses the default theme when the settings name none', async () => {
    const r = await rig({ install: null })
    const theme = await settleStaticTheme(r.themeSwitch, {})
    expect(theme).toMatchObject({ source: 'default', requested: null, identity: { id: 'minimal' } })
  })

  it('uses a theme of the image by its id, and one the image\'s lock pins by its package digest, with no request to the registry', async () => {
    const fake = await registry()
    const r = await rig({ registry: fake })
    expect(await settleStaticTheme(r.themeSwitch, { themeId: 'starter' })).toMatchObject({ source: 'built-in', identity: { id: 'starter' } })
    const pinned = await rig({ registry: fake })
    const theme = await settleStaticTheme(pinned.themeSwitch, { themeId: 'starter', themeVersion: pinned.themeSwitch.status().available.builtIn.find(found => found.id === 'starter')!.version, themeDigest: STARTER_PINNED })
    expect(theme).toMatchObject({ source: 'built-in', identity: { id: 'starter', packageDigest: STARTER_PINNED } })
    expect(fake.seen).toHaveLength(0)
  })

  it('installs the pinned theme the image lacks from the registry, and reports the digests of what it installed', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake })
    const theme = await settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: sample.pin.version, themeDigest: sample.pin.digest })
    expect(theme.source).toBe('installed')
    expect(theme.requested).toEqual(sample.pin)
    expect(theme.identity).toMatchObject({ id: 'sample', version: '1.0.0', packageDigest: sample.pin.digest })
    expect(theme.identity.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(r.themeSwitch.active().runtime.digest).toBe(theme.identity.digest)
  })

  it('refuses a theme the image lacks that no pin comes with, and an invalid pin, without a request to the registry', async () => {
    const fake = await registry()
    const r = await rig({ registry: fake })
    expect(await refused(settleStaticTheme(r.themeSwitch, { themeId: 'does-not-exist' }))).toMatch(/\("does-not-exist"\) was not used \(unknown\)/)
    const bad = await rig({ registry: fake })
    expect(await refused(settleStaticTheme(bad.themeSwitch, { themeId: 'sample', themeVersion: '^1', themeDigest: 'nonsense' }))).toMatch(/\(pin\): .*exact semantic version/)
    // What an editor typed in an invalid pin is not printed into the build's output, where it could pass for a line of the builder
    const forged = await rig({ registry: fake })
    const echoed = await refused(settleStaticTheme(forged.themeSwitch, { themeId: 'Sample\nmicelio-builder: forged', themeVersion: 'v\nStatic theme: forged', themeDigest: 'nonsense' }))
    expect(echoed).toContain('a theme id that is not valid')
    expect(echoed).not.toMatch(/forged|Sample/)
    const partial = await rig({ registry: fake })
    expect(await refused(settleStaticTheme(partial.themeSwitch, { themeVersion: '1.0.0' }))).toMatch(/\(a version or a digest with no theme id\) was not used \(pin\): .*themeVersion and themeDigest need a themeId/)
    expect(fake.seen).toHaveLength(0)
  })

  it('refuses a version the signed index does not list with that digest, and a package that does not match its digest', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake })
    expect(await refused(settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: `sha256:${'a'.repeat(64)}` }))).toMatch(/\(registry\): the registry index does not list this version with this digest/)
    const other = packaged('other')
    publishAll(fake, [sample, other])
    fake.tamper(other.pin.digest, Buffer.from('not the package'))
    const tampered = await rig({ registry: fake })
    expect(await refused(settleStaticTheme(tampered.themeSwitch, { themeId: 'other', themeVersion: '1.0.0', themeDigest: other.pin.digest }))).toContain('(registry)')
    expect(tampered.themeSwitch.active().runtime.id).toBe('minimal')
  })

  it('refuses a package whose attestation is missing or names another signer', async () => {
    const fake = await registry()
    const unsigned = packaged('unsigned')
    fake.publish('unsigned', '1.0.0', unsigned.data, undefined, false)
    const wrong = packaged('wrong')
    fake.publish('wrong', '1.0.0', wrong.data, undefined, 'https://example.test/other.yml@refs/heads/main')
    fake.publishIndex({ version: 1, themes: Object.fromEntries([unsigned, wrong].map(({ pin }) => [pin.id, { versions: { [pin.version]: { digest: pin.digest, contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false } } }])) })
    for (const { pin } of [unsigned, wrong]) {
      const r = await rig({ registry: fake })
      expect(await refused(settleStaticTheme(r.themeSwitch, { themeId: pin.id, themeVersion: pin.version, themeDigest: pin.digest }))).toContain('(registry)')
      expect(r.themeSwitch.active().runtime.id).toBe('minimal')
    }
  })

  it('refuses a tier the instance does not install, and says which it installs', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample], { sample: { tier: 'community' } })
    const r = await rig({ registry: fake })
    const message = await refused(settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))
    expect(message).toMatch(/\(tier\): the tier "community" of this theme is not installed here; this instance installs: official, verified \(MICELIO_THEME_TIERS\)/)
  })

  it('refuses a code theme this image was not built with, whether the registry lists it or not, and never installs it', async () => {
    const fake = await registry()
    const r = await rig({ registry: fake })
    const message = await refused(settleStaticTheme(r.themeSwitch, { themeId: 'starter', themeVersion: '9.9.9', themeDigest: `sha256:${'b'.repeat(64)}` }))
    expect(message).toMatch(/\(code\): theme "starter" ships code and this image was built with another version of it/)
    expect(fake.seen).toHaveLength(0)
    const sample = packaged('code-sample')
    publishAll(fake, [sample], { 'code-sample': { code: true } })
    const listed = await rig({ registry: fake })
    expect(await refused(settleStaticTheme(listed.themeSwitch, { themeId: 'code-sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))).toMatch(/\(code\): the theme ships code/)
  })

  describe('a version the index yanked (ADR 0009, section 3(a))', () => {
    const yanked = { sample: { status: 'yanked', yank: { reason: 'broken', at: '2026-10-30T00:00:00Z' } } }

    it('refuses it for a site that is not live on it, so a yank stops new installs', async () => {
      const fake = await registry()
      const sample = packaged('sample')
      publishAll(fake, [sample], yanked)
      const r = await rig({ registry: fake })
      expect(await refused(settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))).toMatch(/\(registry\): the index marks this version yanked/)
      const other = await rig({ registry: fake, deps: { live: `sha256:${'c'.repeat(64)}` } })
      expect(await refused(settleStaticTheme(other.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))).toMatch(/the index marks this version yanked/)
    })

    it('installs it, with a warning, for the site that is live on that digest, so a yank does not stop its content rebuilds', async () => {
      const fake = await registry()
      const sample = packaged('sample')
      publishAll(fake, [sample], yanked)
      const r = await rig({ registry: fake, deps: { live: sample.pin.digest } })
      expect(await settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })).toMatchObject({ source: 'installed', identity: { id: 'sample', packageDigest: sample.pin.digest } })
      expect(r.warnings.filter(line => line.includes('was yanked from the registry'))).toHaveLength(1)
      expect(r.warnings.join('\n')).toContain('sample@1.0.0')
    })

    it('does not warn for a version that is not yanked, and does not let a live site install one marked incompatible', async () => {
      const fake = await registry()
      const sample = packaged('sample')
      publishAll(fake, [sample])
      const listed = await rig({ registry: fake, deps: { live: sample.pin.digest } })
      await settleStaticTheme(listed.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
      expect(listed.warnings.join('\n')).not.toContain('yanked')
      const pulled = await registry()
      publishAll(pulled, [sample], { sample: { status: 'incompatible', incompatible: { core: '0.5.0', reason: 'breaks the header', at: '2026-10-30T00:00:00Z' } } })
      const r = await rig({ registry: pulled, deps: { live: sample.pin.digest } })
      expect(await refused(settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))).toMatch(/the index marks this version incompatible/)
    })
  })

  describe('readLiveDigest', () => {
    const digest = `sha256:${'d'.repeat(64)}`
    const site = (audit: string | null): string => {
      const dir = scratch()
      if (audit !== null) writeFileSync(join(dir, '_micelio.json'), audit)
      return dir
    }

    it('reads the package digest the site was published with', () => {
      expect(readLiveDigest(site(JSON.stringify({ theme: { id: 'sample', packageDigest: digest } })))).toBe(digest)
    })

    it('finds nothing in a first build, an unreadable file, or a value that is not a digest', () => {
      expect(readLiveDigest(undefined)).toBeUndefined()
      expect(readLiveDigest('')).toBeUndefined()
      expect(readLiveDigest(site(null))).toBeUndefined()
      expect(readLiveDigest(site('not json'))).toBeUndefined()
      expect(readLiveDigest(site('{}'))).toBeUndefined()
      expect(readLiveDigest(site(JSON.stringify({ theme: { packageDigest: 'sha256:xyz' } })))).toBeUndefined()
      expect(readLiveDigest(site(JSON.stringify({ theme: { packageDigest: 5 } })))).toBeUndefined()
    })
  })

  describe('a version the index marks incompatible (#314)', () => {
    const core = '0.5.5'
    /** A switch whose registry client is told the version of the core, as the static build tells it, or not told one, as the server's is. */
    function withCore(fake: FakeRegistry, version: string | undefined): ReturnType<typeof rig> {
      return rig({ registry: fake, install: { registry: () => createRegistry({ registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier, ...(version && { core: version }) }) } })
    }

    it('refuses it from the core the index names on, so a site never gets a theme the maintainers pulled for its core', async () => {
      const fake = await registry()
      const sample = packaged('sample')
      publishAll(fake, [sample], { sample: { status: 'incompatible', incompatible: { core: '0.5.0', reason: 'breaks the header', at: '2026-10-30T00:00:00Z' } } })
      const r = await withCore(fake, core)
      expect(await refused(settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))).toMatch(/\(registry\): the index marks this version incompatible/)
    })

    it('still installs it on a core older than the one the index names, which only a client given its core can tell', async () => {
      const fake = await registry()
      const sample = packaged('sample')
      publishAll(fake, [sample], { sample: { status: 'incompatible', incompatible: { core: '0.9.0', reason: 'needs a later header', at: '2026-10-30T00:00:00Z' } } })
      const withoutCore = await withCore(fake, undefined)
      expect(await refused(settleStaticTheme(withoutCore.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))).toContain('incompatible')
      const r = await withCore(fake, core)
      expect(await settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })).toMatchObject({ source: 'installed', identity: { id: 'sample' } })
    })
  })

  it('refuses to install when installing is off, and names the variable', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake, install: { enabled: false } })
    expect(await refused(settleStaticTheme(r.themeSwitch, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))).toMatch(/\(off\): .*MICELIO_THEME_INSTALL/)
    expect(fake.seen).toHaveLength(0)
  })

  it('fails, and does not report the default theme, when the switch has not reached the theme the settings name in time', async () => {
    const stuck = {
      observe: () => undefined,
      settled: () => Promise.resolve(),
      status: () => ({ active: { id: 'minimal', digest: 'd', packageDigest: 'p' }, requested: { id: 'sample', version: '1.0.0', digest: 'sha256:x' }, lastGood: null, error: null, available: { builtIn: [], registry: { install: true, tiers: [] } } }),
    } as unknown as ThemeSwitch
    expect(await refused(settleStaticTheme(stuck, { themeId: 'sample' }, 3000))).toContain('was not ready after 3 s')
  })
})

describe('resolveStaticTheme', () => {
  function env(fake: FakeRegistry, more: Record<string, string> = {}): Record<string, string> {
    return { MICELIO_THEME_REGISTRY: fake.registry, MICELIO_THEME_REGISTRY_IDENTITY: `issuer=${TEST_IDENTITY.issuer},package=${TEST_IDENTITY.packages},index=${TEST_IDENTITY.index}`, ...more }
  }

  it('reads the settings, installs the pinned theme into the store of the build and tells the registry client the core', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const cms = await strapi(withTheme({ themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))
    const builtInDir = await builtInStore()
    const theme = await resolveStaticTheme({ builtInDir, configured: '', env: env(fake), strapi: { strapiUrl: cms.url, strapiApiToken: 'build-token' }, core: '0.5.5', warn: () => undefined })
    expect(theme).toMatchObject({ source: 'installed', identity: { id: 'sample', packageDigest: sample.pin.digest } })
    expect(created.options.at(-1)?.core).toBe('0.5.5')
    expect(cms.asked).toHaveLength(1)
    // What the build does next (`adoptResolvedTheme`): list it, and the prerender's server then loads it as it loads any built-in theme
    const before = JSON.parse(readFileSync(join(builtInDir, 'index.json'), 'utf8')) as BuiltInIndex
    expect(before.themes.sample).toBeUndefined()
    const build: Record<string, string | undefined> = {}
    adoptResolvedTheme(builtInDir, before, theme, build)
    const index = JSON.parse(readFileSync(join(builtInDir, 'index.json'), 'utf8')) as BuiltInIndex
    expect(index.themes.sample).toEqual({ digest: theme.identity.digest, version: '1.0.0', code: false, pinned: sample.pin.digest })
    expect(build.NUXT_PUBLIC_THEME).toBe('sample')
    const loaded = loadDefaultTheme(builtInDir, 'sample')
    expect(loaded.runtime.digest).toBe(theme.identity.digest)
    expect(loaded.pinned).toBe(sample.pin.digest)
    // And the files a visitor's browser asks for at /_t/<digest>/ are copied out of its entry, and the server's own files are not
    const published = copyPublishedFiles(builtInDir, theme.identity.digest)
    expect(existsSync(join(published, 'theme.css'))).toBe(true)
    expect(existsSync(join(published, 'manifest.json'))).toBe(false)
    expect(existsSync(join(published, 'runtime.json'))).toBe(false)
  })

  it('reads the digest the site is live on from the OUT_DIR of its environment, so only the build of that site installs a yanked version', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample], { sample: { status: 'yanked', yank: { reason: 'broken', at: '2026-10-30T00:00:00Z' } } })
    const cms = await strapi(withTheme({ themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }))
    const published = scratch()
    const warned: string[] = []
    const options = { configured: '', strapi: { strapiUrl: cms.url, strapiApiToken: 't' }, warn: (_event: string, message: string) => void warned.push(message) }
    const audit = (packageDigest: string): void => writeFileSync(join(published, '_micelio.json'), JSON.stringify({ theme: { id: 'sample', packageDigest } }))
    // No OUT_DIR, no file, or a file that names another package: a yank stops the install
    expect(await refused(resolveStaticTheme({ ...options, env: env(fake), builtInDir: await builtInStore() }))).toMatch(/the index marks this version yanked/)
    expect(await refused(resolveStaticTheme({ ...options, env: env(fake, { OUT_DIR: published }), builtInDir: await builtInStore() }))).toMatch(/the index marks this version yanked/)
    audit(`sha256:${'c'.repeat(64)}`)
    expect(await refused(resolveStaticTheme({ ...options, env: env(fake, { OUT_DIR: published }), builtInDir: await builtInStore() }))).toMatch(/the index marks this version yanked/)
    expect(warned.some(message => message.includes('was yanked from the registry'))).toBe(false)
    // The file names the pinned digest: the site is live on it, so it installs, and the log says which theme the site is live on
    audit(sample.pin.digest)
    expect(await resolveStaticTheme({ ...options, env: env(fake, { OUT_DIR: published }), builtInDir: await builtInStore() })).toMatchObject({ source: 'installed', identity: { id: 'sample' } })
    expect(warned.some(message => message.includes(`is live on the theme package ${sample.pin.digest}`))).toBe(true)
    expect(warned.some(message => message.includes('was yanked from the registry'))).toBe(true)
  })

  it('names a theme of the image as the default of the prerender without touching the index, and leaves the default theme unnamed', async () => {
    const builtInDir = await builtInStore()
    const index = JSON.parse(readFileSync(join(builtInDir, 'index.json'), 'utf8')) as BuiltInIndex
    const identity = { id: 'starter', digest: 'a'.repeat(64), packageDigest: STARTER_PINNED }
    const builtIn: Record<string, string | undefined> = {}
    adoptResolvedTheme(builtInDir, index, { identity, source: 'built-in', requested: null }, builtIn)
    expect(builtIn.NUXT_PUBLIC_THEME).toBe('starter')
    expect(JSON.parse(readFileSync(join(builtInDir, 'index.json'), 'utf8'))).toEqual(index)
    const standard: Record<string, string | undefined> = {}
    adoptResolvedTheme(builtInDir, index, { identity, source: 'default', requested: null }, standard)
    expect(standard.NUXT_PUBLIC_THEME).toBeUndefined()
  })

  it('does not tell the registry client a core the caller did not give', async () => {
    const fake = await registry()
    const cms = await strapi(withTheme(null))
    await resolveStaticTheme({ builtInDir: await builtInStore(), configured: '', env: env(fake), strapi: { strapiUrl: cms.url, strapiApiToken: 't' }, warn: () => undefined })
    expect(created.options.every(options => options.core === undefined)).toBe(true)
  })

  it('uses the default theme when the settings name none, and reads nothing without a Strapi and a token', async () => {
    const fake = await registry()
    const cms = await strapi(withTheme({}))
    const named = await resolveStaticTheme({ builtInDir: await builtInStore(), configured: '', env: env(fake), strapi: { strapiUrl: cms.url, strapiApiToken: 't' }, warn: () => undefined })
    expect(named).toMatchObject({ source: 'default', identity: { id: 'minimal' } })
    const without = await resolveStaticTheme({ builtInDir: await builtInStore(), configured: 'starter', env: env(fake), strapi: { strapiUrl: '', strapiApiToken: '' }, warn: () => undefined })
    expect(without).toMatchObject({ source: 'default', identity: { id: 'starter' } })
    expect(cms.asked).toHaveLength(1)
  })

  it('stops with the reason when the theme the settings name is refused, and with the name of the variable when one is invalid', async () => {
    const fake = await registry()
    const cms = await strapi(withTheme({ themeId: 'does-not-exist' }))
    const message = await refused(resolveStaticTheme({ builtInDir: await builtInStore(), configured: '', env: env(fake), strapi: { strapiUrl: cms.url, strapiApiToken: 't' }, warn: () => undefined }))
    expect(message).toMatch(/^Static theme: the theme the site settings name \("does-not-exist"\) was not used \(unknown\)/)
    await expect(resolveStaticTheme({ builtInDir: await builtInStore(), configured: '', env: env(fake, { MICELIO_THEME_TIERS: 'official,gold' }), strapi: { strapiUrl: cms.url, strapiApiToken: 't' }, warn: () => undefined })).rejects.toThrow('MICELIO_THEME_TIERS')
  })
})
