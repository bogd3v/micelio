import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, truncateSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { STATE_FILE, STORE_MAX_BYTES } from '../server/lib/themeSwitch/constants'
import { createGuardedFetch, isPrivateAddress } from '../server/lib/themeSwitch/guardedFetch'
import { createInstallLimiter, storeFull } from '../server/lib/themeSwitch/limits'
import { pinRequestToTheme, THEME_HEADER } from '../server/lib/themeSwitch/request'
import { readPins, writePins } from '../server/lib/themeSwitch/state'
import { readTiers } from '../server/lib/themeSwitch/tiers'
import { purgePageCache } from '../server/utils/themeCache'
import type { BuiltInTheme } from '../server/lib/types'
import { RegistryError } from '../modules/theme/registry/error'
import { lockedDigest } from '../modules/theme/install/pinned'
import { cleanup, scratch } from './fixtures/themeSwitch'

afterEach(cleanup)

const pin = (n: number): { id: string, version: string, digest: string } => ({ id: 'sample', version: `1.0.${n}`, digest: `sha256:${n.toString(16).padStart(64, '0')}` })

describe('readTiers', () => {
  it('installs official and verified when nothing is set', () => {
    for (const value of [undefined, '', '  ', ' , ']) expect([...readTiers(value)], String(value)).toEqual(['official', 'verified'])
  })

  it('reads a comma-separated list', () => {
    expect([...readTiers('official, verified ,community')]).toEqual(['official', 'verified', 'community'])
    expect([...readTiers('official')]).toEqual(['official'])
  })

  it('stops the boot, naming the variable and the tier, for a tier that does not exist', () => {
    expect(() => readTiers('official,gold')).toThrow('MICELIO_THEME_TIERS names an unknown tier "gold"')
    expect(() => readTiers('local')).toThrow('MICELIO_THEME_TIERS')
    expect(() => readTiers('x'.repeat(500))).toThrow(/"x{40}"/)
  })
})

describe('the install limiter', () => {
  it('allows six installs an hour and the seventh waits for the oldest to age out', () => {
    let now = 0
    const limiter = createInstallLimiter(() => now)
    for (let index = 0; index < 6; index++) {
      expect(limiter.refusal(pin(index))).toBeNull()
      limiter.begin()
      now += 60_000
    }
    expect(limiter.refusal(pin(7))).toMatchObject({ kind: 'rate', message: expect.stringContaining('6 installs') })
    now = 60 * 60_000 - 1
    expect(limiter.refusal(pin(7))).not.toBeNull()
    now = 60 * 60_000
    expect(limiter.refusal(pin(7))).toBeNull()
  })

  it('waits a minute after a failed pin, doubling up to an hour, and forgets a pin that installs', () => {
    let now = 0
    const limiter = createInstallLimiter(() => now)
    const waits: number[] = []
    for (let failure = 0; failure < 9; failure++) {
      limiter.fail(pin(1))
      const start = now
      while (limiter.refusal(pin(1))) now += 1000
      waits.push((now - start) / 1000)
    }
    expect(waits).toEqual([60, 120, 240, 480, 960, 1920, 3600, 3600, 3600])
    limiter.fail(pin(1))
    expect(limiter.refusal(pin(1))?.kind).toBe('backoff')
    expect(limiter.refusal(pin(2))).toBeNull()
    limiter.succeed(pin(1))
    expect(limiter.refusal(pin(1))).toBeNull()
  })

  it('remembers a bounded number of failed pins, forgetting the oldest', () => {
    const limiter = createInstallLimiter(() => 0)
    for (let index = 0; index < 201; index++) limiter.fail(pin(index))
    expect(limiter.refusal(pin(0))).toBeNull()
    expect(limiter.refusal(pin(200))?.kind).toBe('backoff')
  })
})

describe('storeFull', () => {
  it('has room in a store that does not exist yet and in a small one', async () => {
    expect(await storeFull(join(scratch(), 'missing'))).toBeNull()
    const store = scratch()
    mkdirSync(join(store, 'v1/entries/a'), { recursive: true })
    expect(await storeFull(store)).toBeNull()
  })

  it('is full at 50 entries', async () => {
    const store = scratch()
    for (let index = 0; index < 49; index++) mkdirSync(join(store, 'v1/entries', String(index)), { recursive: true })
    expect(await storeFull(store)).toBeNull()
    mkdirSync(join(store, 'v1/entries/49'))
    expect(await storeFull(store)).toContain('50 entries')
  })

  it('is full at 256 MiB of entries and kept packages together', async () => {
    const store = scratch()
    mkdirSync(join(store, 'v1/entries/a'), { recursive: true })
    mkdirSync(join(store, 'v1/packages/b'), { recursive: true })
    writeFileSync(join(store, 'v1/entries/a/file'), '')
    writeFileSync(join(store, 'v1/packages/b/package.tgz'), '')
    truncateSync(join(store, 'v1/entries/a/file'), STORE_MAX_BYTES / 2)
    expect(await storeFull(store)).toBeNull()
    truncateSync(join(store, 'v1/packages/b/package.tgz'), STORE_MAX_BYTES / 2)
    expect(await storeFull(store)).toContain('256 MiB')
  })
})

describe('the guarded fetch', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '64:ff9b::a00:5', '64:ff9b::10.0.0.5', '2002:a00:5::1', '::7f00:1', 'not an address'])('refuses %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each(['8.8.8.8', '140.82.112.3', '172.15.0.1', '172.32.0.1', '2606:4700::1111', '64:ff9b::808:808', '2002:808:808::1'])('allows %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false)
  })

  it('refuses a host other than the registry\'s that resolves to a private address, without sending anything', async () => {
    const send = vi.fn(() => Promise.resolve(new Response('ok')))
    const guarded = createGuardedFetch({ registryHost: 'registry.example.test', signal: new AbortController().signal, resolve: host => Promise.resolve(host === 'storage.example.test' ? ['203.0.113.7'] : ['203.0.113.7', '10.0.0.5']), fetch: send as unknown as typeof fetch })
    await expect(guarded('https://rebind.example.test/blob')).rejects.toBeInstanceOf(RegistryError)
    await expect(guarded('https://169.254.169.254/latest')).rejects.toBeInstanceOf(RegistryError)
    expect(send).not.toHaveBeenCalled()
    expect((await guarded('https://storage.example.test/blob')).status).toBe(200)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('lets the configured registry be private, and stops every request when the download deadline passes', async () => {
    const aborted: boolean[] = []
    const send = vi.fn((_url: unknown, init?: RequestInit) => {
      aborted.push(init?.signal?.aborted === true)
      return Promise.resolve(new Response('ok'))
    })
    const resolve = vi.fn(() => Promise.resolve(['10.0.0.5']))
    const deadline = new AbortController()
    const guarded = createGuardedFetch({ registryHost: '10.0.0.5:5000', signal: deadline.signal, resolve, fetch: send as unknown as typeof fetch })
    await guarded('http://10.0.0.5:5000/v2/')
    expect(resolve).not.toHaveBeenCalled()
    deadline.abort()
    await guarded('http://10.0.0.5:5000/v2/')
    expect(aborted).toEqual([false, true])
    // A request's own signal and the deadline both stop it
    const own = new AbortController()
    const fresh = createGuardedFetch({ registryHost: '10.0.0.5:5000', signal: new AbortController().signal, fetch: send as unknown as typeof fetch })
    own.abort()
    await fresh('http://10.0.0.5:5000/v2/', { signal: own.signal })
    expect(aborted).toEqual([false, true, true])
  })
})

describe('the remembered pins', () => {
  it('round-trips and drops what is not a valid pin', async () => {
    const store = scratch()
    expect(await readPins(store)).toEqual({ active: null, lastGood: null })
    await writePins(store, { active: pin(1), lastGood: pin(2) })
    expect(await readPins(store)).toEqual({ active: pin(1), lastGood: pin(2) })
    writeFileSync(join(store, 'v1', STATE_FILE), JSON.stringify({ active: { id: '../x', version: '1.0.0', digest: pin(1).digest }, lastGood: pin(2) }))
    expect(await readPins(store)).toEqual({ active: null, lastGood: pin(2) })
    writeFileSync(join(store, 'v1', STATE_FILE), '{"active":')
    expect(await readPins(store)).toEqual({ active: null, lastGood: null })
  })
})

describe('the page cache', () => {
  it('drops the pages Nitro cached and nothing else', async () => {
    const clear = vi.fn(() => Promise.resolve())
    await purgePageCache({ clear })
    expect(clear).toHaveBeenCalledExactlyOnceWith('cache:nitro:routes')
  })

  it('pins a request to the theme it began with, and a visitor\'s own header never reaches the cache key', () => {
    const theme = { runtime: { digest: 'a'.repeat(64) } } as BuiltInTheme
    const event = { context: {}, node: { req: { headers: { [THEME_HEADER]: 'b'.repeat(64), accept: '*/*' } } } }
    const view = { data: { id: 'x' }, messages: {} }
    pinRequestToTheme(event as never, theme, view as never)
    expect(event.node.req.headers[THEME_HEADER]).toBe('a'.repeat(64))
    expect(event.context).toMatchObject({ activeTheme: theme, theme: view.data, themeMessages: view.messages })
  })
})

describe('pruneDeploymentStore', () => {
  it('removes the entries of other core builds and the packages nothing uses, and keeps the active and last good ones', async () => {
    const { builtInStore, packaged } = await import('./fixtures/themeSwitch')
    const { installTheme } = await import('../modules/theme/install/install')
    const { pruneDeploymentStore } = await import('../server/lib/themeSwitch/prune')
    const { readdirSync } = await import('node:fs')
    const { HOOKS } = await import('./fixtures/themeSwitch')
    const builtIn = await builtInStore()
    const store = scratch()
    const current = packaged('current')
    const old = packaged('old')
    const unused = packaged('unused')
    await installTheme({ kind: 'package', ...current }, { storeDir: store, hooks: HOOKS, coreBuild: 'switch', layoutCss: {} })
    await installTheme({ kind: 'package', ...old }, { storeDir: store, hooks: HOOKS, coreBuild: 'older', layoutCss: {} })
    await installTheme({ kind: 'package', ...unused }, { storeDir: store, hooks: HOOKS, coreBuild: 'older', layoutCss: {} })
    await writePins(store, { active: current.pin, lastGood: old.pin })
    const removed = await pruneDeploymentStore(store, builtIn)
    expect(removed.entries).toHaveLength(2)
    expect(removed.packages).toEqual([unused.pin.digest])
    expect(readdirSync(join(store, 'v1/entries'))).toHaveLength(1)
    // The last good theme's entry is gone (it was compiled for an older core) but its package is kept to compile it again
    expect(readdirSync(join(store, 'v1/packages')).sort()).toEqual([current.pin.digest.slice(7), old.pin.digest.slice(7)].sort())
  })
})

describe('decidesTheme', () => {
  it('lets the default language of a server decide, and never a static or landing build', async () => {
    const { decidesTheme } = await import('../server/lib/themeSwitch/request')
    const { Locale } = await import('../app/interfaces/locale')
    expect(decidesTheme(Locale.English, 'dynamic')).toBe(true)
    expect(decidesTheme(Locale.SpanishColombia, 'dynamic')).toBe(false)
    expect(decidesTheme(Locale.English, 'static')).toBe(false)
    expect(decidesTheme(Locale.English, 'landing')).toBe(false)
  })
})

describe('overridesFor', () => {
  it('gives the overrides to the theme they were resolved against and to no other', async () => {
    const { overridesFor } = await import('../server/lib/themeSwitch/request')
    const theme = { id: 'x', defaultMode: 'dark', accents: {} }
    expect(overridesFor({ themeDigest: 'a', site: { theme } }, 'a')).toBe(theme)
    expect(overridesFor({ themeDigest: 'a', site: { theme } }, 'b')).toBeUndefined()
    expect(overridesFor(undefined, 'a')).toBeUndefined()
    expect(overridesFor({ themeDigest: 'a', site: {} }, 'a')).toBeUndefined()
  })
})

describe('lockedDigest', () => {
  const lock = { sample: { version: '1.0.0', digest: `sha256:${'1'.repeat(64)}` } } as unknown as Parameters<typeof lockedDigest>[0]

  it('pins the pulled package, and not a local folder that shadows it', () => {
    expect(lockedDigest(lock, 'sample', '/repo/.micelio/themes/sample')).toBe(`sha256:${'1'.repeat(64)}`)
    expect(lockedDigest(lock, 'sample', '/repo/themes/sample')).toBeUndefined()
    expect(lockedDigest(lock, 'sample', '/elsewhere/alternates/sample')).toBeUndefined()
    expect(lockedDigest(lock, 'other', '/repo/.micelio/themes/other')).toBeUndefined()
  })
})
