import { afterEach, describe, expect, it, vi } from 'vitest'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { installTheme } from '../modules/theme/install/install'
import { createRegistry } from '../modules/theme/registry/client'
import { RegistryError } from '../modules/theme/registry/error'
import { installIsolated } from '../modules/theme/install/isolated'
import { loadBuiltInTheme } from '../server/lib/builtInStore'
import { readTiers } from '../server/lib/themeSwitch/tiers'
import { PREVIOUS_SERVED_MS } from '../server/lib/themeSwitch/constants'
import { digestOf, startRegistry, stubVerifier, TEST_IDENTITY } from './fixtures/registry'
import type { FakeRegistry } from './fixtures/registry'
import { noise } from './fixtures/tar'
import { cleanup, installFor, packaged, publishAll, repacked, rig, ROOT, STARTER_PINNED } from './fixtures/themeSwitch'
import type { Rig } from './fixtures/themeSwitch'

const registries: FakeRegistry[] = []

async function registry(): Promise<FakeRegistry> {
  const fake = await startRegistry()
  registries.push(fake)
  return fake
}

afterEach(async () => {
  await Promise.all(registries.splice(0).map(fake => fake.close()))
  cleanup()
})

/** Whether the fake registry was asked for a package (a blob or a manifest of a theme), not only the index. */
function downloaded(fake: FakeRegistry): boolean {
  // A package's tag is its semver; the index is `v1`
  return fake.seen.some(request => /\/manifests\/\d/.test(request.path))
}

async function observed(r: Rig, raw: Parameters<Rig['themeSwitch']['observe']>[0]): Promise<void> {
  r.themeSwitch.observe(raw)
  await r.settle()
}

describe('the theme the site settings name', () => {
  it('switches to a theme built into the image by its id, and back to the default when the settings name none', async () => {
    const r = await rig({ install: null })
    const first = r.themeSwitch.active()
    expect(first.runtime.id).toBe('minimal')
    await observed(r, { themeId: 'starter' })
    expect(r.themeSwitch.active().runtime.id).toBe('starter')
    expect(r.switches).toHaveLength(1)
    expect(r.switches[0]).toEqual({ from: first.runtime.digest, to: r.themeSwitch.active().runtime.digest })
    await observed(r, {})
    expect(r.themeSwitch.active()).toBe(first)
    expect(r.themeSwitch.status().requested).toBeNull()
    expect(r.themeSwitch.status().error).toBeNull()
  })

  it('serves the digest of the theme it replaced for an hour, then drops it, and keeps the last good one and only the last two retired', async () => {
    const fake = await registry()
    const [one, two, three] = [packaged('one'), packaged('two'), packaged('three')] as const
    publishAll(fake, [one, two, three])
    const r = await rig({ registry: fake })
    const digests: string[] = [r.themeSwitch.active().runtime.digest]
    for (const { pin } of [one, two, three]) {
      await observed(r, { themeId: pin.id, themeVersion: pin.version, themeDigest: pin.digest })
      digests.push(r.themeSwitch.active().runtime.digest)
    }
    const [minimal, first, second, third] = digests as [string, string, string, string]
    expect(r.themeSwitch.served(third)?.runtime.id).toBe('three')
    expect(r.themeSwitch.served(second)?.runtime.id).toBe('two')
    expect(r.themeSwitch.served(first)?.runtime.id).toBe('one')
    // Only the last two are retired, and the digest that is not served is the one that went first
    expect(r.themeSwitch.served(minimal)).toBeUndefined()
    expect(r.themeSwitch.served('0'.repeat(64))).toBeUndefined()
    expect(r.themeSwitch.status().lastGood?.id).toBe('two')
    r.clock.now += PREVIOUS_SERVED_MS - 1
    expect(r.themeSwitch.served(first)?.runtime.id).toBe('one')
    r.clock.now += 2
    // Past the hour the retired digests go; the last good one stays
    expect(r.themeSwitch.served(first)).toBeUndefined()
    expect(r.themeSwitch.served(second)?.runtime.id).toBe('two')
    expect(r.themeSwitch.served(third)?.runtime.id).toBe('three')
  })

  it('reports an id the image does not have and keeps the current theme', async () => {
    const r = await rig({ install: null })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'nope' })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.switches).toEqual([])
    expect(r.themeSwitch.status().requested).toEqual({ id: 'nope' })
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'unknown', message: expect.stringContaining('"nope" is not built into this image') })
    expect(r.warnings).toHaveLength(1)
  })

  it('logs an invalid pin once and ignores it, whatever its shape, without a request or a path', async () => {
    const fake = await registry()
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    const digest = `sha256:${'a'.repeat(64)}`
    const invalid = [
      { themeId: '../etc', themeVersion: '1.0.0', themeDigest: digest },
      { themeId: 'UPPER', themeVersion: '1.0.0', themeDigest: digest },
      { themeId: 'good', themeVersion: 'latest', themeDigest: digest },
      { themeId: 'good', themeVersion: '1.0.0', themeDigest: 'sha256:xyz' },
      { themeId: 'good', themeVersion: '1.0.0+build', themeDigest: digest },
      { themeId: 'good', themeVersion: '1.0.0' },
      { themeId: 'good', themeDigest: digest },
      { themeVersion: '1.0.0', themeDigest: digest },
    ]
    for (const raw of invalid) {
      await observed(r, raw)
      expect(r.themeSwitch.active(), JSON.stringify(raw)).toBe(before)
      expect(r.themeSwitch.status().error?.rule, JSON.stringify(raw)).toBe('pin')
    }
    expect(r.warnings).toHaveLength(invalid.length)
    // The same invalid pin again is not logged again
    await observed(r, invalid.at(-1)!)
    expect(r.warnings).toHaveLength(invalid.length)
    expect(fake.seen).toEqual([])
    expect(r.switches).toEqual([])
    expect(r.persisted).toEqual([])
  })

  it('is one state: the status, the active theme and the served digests agree during and after a switch', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    r.themeSwitch.observe({ themeId: sample.pin.id, themeVersion: sample.pin.version, themeDigest: sample.pin.digest })
    // Not waited for: the request path sees the old theme in full until the new one is complete
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().active.digest).toBe(before.runtime.digest)
    expect(r.themeSwitch.status().requested).toEqual(sample.pin)
    await r.settle()
    const after = r.themeSwitch.active()
    expect(after.runtime.id).toBe('sample')
    expect(r.themeSwitch.status().active).toMatchObject({ id: 'sample', digest: after.runtime.digest, packageDigest: sample.pin.digest })
    expect(r.themeSwitch.served(before.runtime.digest)).toBe(before)
    expect(r.switches).toEqual([{ from: before.runtime.digest, to: after.runtime.digest }])
    expect(r.persisted).toEqual([{ active: sample.pin, lastGood: null }])
  })
})

describe('a theme from the registry', () => {
  it('installs a data-only package of an allowed tier, checks its attestation and activates it', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake })
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.active().runtime.id).toBe('sample')
    expect(r.themeSwitch.status().error).toBeNull()
    expect(existsSync(join(r.deployment, 'v1/entries', r.themeSwitch.active().runtime.digest))).toBe(true)
    expect(existsSync(join(r.deployment, 'v1/packages', sample.pin.digest.slice(7), 'attestation.json')) || readdirSync(join(r.deployment, 'v1/packages', sample.pin.digest.slice(7))).length > 1).toBe(true)
  })

  it('keeps the current theme and says so when the digest in the settings is not the one the registry lists', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: `sha256:${'b'.repeat(64)}` })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'registry', message: expect.stringContaining('does not list this version with this digest') })
    expect(downloaded(fake)).toBe(false)
    expect(readdirSync(r.deployment)).toEqual([])
  })

  it('keeps the current theme when the bytes the registry serves do not hash to the pinned digest', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    fake.tamper(sample.pin.digest, Buffer.from('not the package'))
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error?.rule).toBe('registry')
    expect(existsSync(join(r.deployment, 'v1/entries'))).toBe(false)
  })

  it('refuses a package whose attestation is not from the expected signer', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    fake.publish('sample', '1.0.0', sample.data, undefined, 'https://evil.example.test/publish.yml@refs/heads/main')
    fake.publishIndex({ version: 1, themes: { sample: { versions: { '1.0.0': { digest: digestOf(sample.data), contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false } } } } })
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'registry' })
    expect(existsSync(join(r.deployment, 'v1/entries'))).toBe(false)
  })

  it('refuses a registry it has no signer identity for, before any request to it', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake, install: { registry: () => createRegistry({ registry: fake.registry, identity: null }) } })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'registry', message: expect.stringContaining('MICELIO_THEME_REGISTRY_IDENTITY') })
    expect(fake.seen).toEqual([])
  })

  it('refuses a yanked version, except one that was this site\'s own', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    const other = packaged('other')
    publishAll(fake, [sample, other], { sample: { status: 'yanked' } })
    const strangers = await rig({ registry: fake })
    await observed(strangers, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(strangers.themeSwitch.active().runtime.id).toBe('minimal')
    expect(strangers.themeSwitch.status().error).toMatchObject({ rule: 'registry', message: expect.stringContaining('yanked') })
    // The theme the site had before the last switch may come back after it was yanked, even if the store lost it
    publishAll(fake, [sample, other])
    const r = await rig({ registry: fake })
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    await observed(r, { themeId: 'other', themeVersion: '1.0.0', themeDigest: other.pin.digest })
    expect(r.themeSwitch.active().runtime.id).toBe('other')
    rmSync(join(r.deployment, 'v1'), { recursive: true, force: true })
    publishAll(fake, [sample, other], { sample: { status: 'yanked' } })
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.status().error).toBeNull()
    expect(r.themeSwitch.active().runtime.id).toBe('sample')
  })

  it('refuses a package over the size cap', async () => {
    const fake = await registry()
    const big = noise(3 * 1024 * 1024)
    fake.publish('big', '1.0.0', big)
    fake.publishIndex({ version: 1, themes: { big: { versions: { '1.0.0': { digest: digestOf(big), contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false } } } } })
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'big', themeVersion: '1.0.0', themeDigest: digestOf(big) })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'registry', message: expect.stringContaining('limit is') })
    expect(r.persisted).toEqual([])
  })

  it('refuses a tier the server does not install, naming it, and installs it once MICELIO_THEME_TIERS allows it', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample], { sample: { tier: 'community' } })
    const pin = { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest }
    const refused = await rig({ registry: fake })
    const before = refused.themeSwitch.active()
    await observed(refused, pin)
    expect(refused.themeSwitch.active()).toBe(before)
    expect(refused.themeSwitch.status().error).toMatchObject({ rule: 'tier', message: expect.stringContaining('"community"') })
    expect(downloaded(fake)).toBe(false)
    const allowed = await rig({ registry: fake, install: { tiers: readTiers('official,verified,community') } })
    await observed(allowed, pin)
    expect(allowed.themeSwitch.active().runtime.id).toBe('sample')
  })

  it('refuses a code theme the image was not built with, before downloading it', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample], { sample: { code: true } })
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'code', message: expect.stringContaining('only an image built with it') })
    expect(downloaded(fake)).toBe(false)
  })

  it('refuses a package that ships code even when the index says it does not', async () => {
    const fake = await registry()
    const withCode = packaged('sneaky', (dir) => {
      // A slots/ folder makes the package a code theme, whatever the index lists
      cpSync(join(ROOT, 'themes/starter/slots'), join(dir, 'slots'), { recursive: true })
    })
    publishAll(fake, [withCode])
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sneaky', themeVersion: '1.0.0', themeDigest: withCode.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error?.rule).toBe('code')
    expect(existsSync(join(r.deployment, 'v1/entries'))).toBe(false)
  })

  it('refuses a theme that fails the contract checks and leaves nothing in the store', async () => {
    const fake = await registry()
    // Every color the same: it passes the packer only if the packer's own contrast check is skipped, as a registry without admission could
    const bad = repacked(packaged('bad'), (files) => {
      const manifest = JSON.parse(Buffer.from(files.get('theme.json')!).toString('utf8')) as { color: { tokens: Array<{ value: string | Record<string, string> }> } }
      for (const token of manifest.color.tokens) token.value = typeof token.value === 'string' ? '#777777' : Object.fromEntries(Object.keys(token.value).map(mode => [mode, '#777777']))
      files.set('theme.json', Buffer.from(JSON.stringify(manifest)))
    })
    publishAll(fake, [bad])
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'bad', themeVersion: '1.0.0', themeDigest: bad.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'install', message: expect.stringMatching(/needs 4\.5:1/) })
    expect(existsSync(join(r.deployment, 'v1/entries'))).toBe(false)
  })

  it('refuses a data-only theme whose id is a compiled-in code theme\'s, since the slots are chosen by id', async () => {
    const fake = await registry()
    const impostor = packaged('starter')
    publishAll(fake, [impostor])
    const r = await rig({ registry: fake })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'starter', themeVersion: '1.0.0', themeDigest: impostor.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'code', message: expect.stringContaining('another version of it') })
    expect(fake.seen).toEqual([])
  })

  it('activates a code theme at the package digest the image was built with, and not at any other', async () => {
    const r = await rig({ install: null })
    const built = r.themeSwitch.status().available.builtIn.find(theme => theme.id === 'starter')!
    expect(built.code).toBe(true)
    const packageDigest = loadBuiltInTheme(r.builtIn, 'starter').entry.manifest.packageDigest
    await observed(r, { themeId: 'starter', themeVersion: built.version!, themeDigest: packageDigest })
    expect(r.themeSwitch.active().runtime.id).toBe('starter')
    // The digest a site stores is the one the image's lock pins: the registry's package, not the file tree the build installed
    await observed(r, {})
    expect(r.themeSwitch.active().runtime.id).toBe('minimal')
    await observed(r, { themeId: 'starter', themeVersion: built.version!, themeDigest: STARTER_PINNED })
    expect(r.themeSwitch.active().runtime.id).toBe('starter')
    expect(r.themeSwitch.status().active.packageDigest).toBe(STARTER_PINNED)
    await observed(r, { themeId: 'starter', themeVersion: built.version!, themeDigest: `sha256:${'c'.repeat(64)}` })
    expect(r.themeSwitch.active().runtime.id).toBe('starter')
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'code' })
  })
})

describe('what an entry in the store may be', () => {
  it('never activates a code theme, even when the installer let one through and the index said it had none', async () => {
    const fake = await registry()
    const withCode = packaged('sneaky', (dir) => {
      cpSync(join(ROOT, 'themes/starter/slots'), join(dir, 'slots'), { recursive: true })
    })
    publishAll(fake, [withCode])
    // An installer that allows code, as the image build does: the check of the switch is the last one
    const r = await rig({ registry: fake, install: { run: (source, options) => installTheme(source, { ...options, allowCode: true }) } })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sneaky', themeVersion: '1.0.0', themeDigest: withCode.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'code' })
    expect(r.persisted).toEqual([])
  })

  it('never shows a URL, a control character or more than 300 characters of a failure to the CMS', async () => {
    const fake = await registry()
    const text = `failed at https://user:secret@registry.example.test/v2/x?token=abc#frag, wrote /tmp/micelio-install-k3j/entries/abc\nsecond line\u0007 ${'long '.repeat(200)}`
    const r = await rig({ registry: fake, install: { registry: () => ({ listed: () => Promise.reject(new RegistryError('registry', text)) }) as never } })
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: `sha256:${'a'.repeat(64)}` })
    const message = r.themeSwitch.status().error!.message
    expect(message).toContain('failed at <url>')
    expect(message).toContain('wrote <path>')
    expect(message).not.toMatch(/secret|token|https?:|micelio-install/)
    expect([...message].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)).toBe(true)
    expect(message.length).toBeLessThanOrEqual(300)
    expect(r.warnings.join('')).not.toContain('secret')
  })
})

describe('the off switch and the store', () => {
  it('reports a theme missing from the store when installing is off, and downloads nothing', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake, install: { enabled: false } })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'off', message: expect.stringContaining('MICELIO_THEME_INSTALL') })
    expect(r.themeSwitch.status().available.registry).toEqual({ install: false, tiers: ['official', 'verified'] })
    expect(fake.seen).toEqual([])
  })

  it('reports it also when there is no store at all', async () => {
    const r = await rig({ install: null })
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: `sha256:${'d'.repeat(64)}` })
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'off', message: expect.stringContaining('MICELIO_THEME_STORE') })
    expect(r.themeSwitch.status().available.registry).toEqual({ install: false, tiers: [] })
  })

  it('activates a theme the store already holds when installing is off', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const first = await rig({ registry: fake })
    await observed(first, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(first.themeSwitch.active().runtime.id).toBe('sample')
    const second = await rig({ registry: fake, builtIn: first.builtIn, deployment: first.deployment, install: { enabled: false } })
    const requests = fake.seen.length
    await observed(second, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(second.themeSwitch.active().runtime.id).toBe('sample')
    expect(second.themeSwitch.status().error).toBeNull()
    expect(fake.seen.length).toBe(requests)
  })

  it('keeps serving the installed theme when the registry is unreachable', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    const other = packaged('other')
    publishAll(fake, [sample, other])
    const r = await rig({ registry: fake })
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    const installed = r.themeSwitch.active()
    await fake.close()
    registries.splice(registries.indexOf(fake), 1)
    await observed(r, { themeId: 'other', themeVersion: '1.0.0', themeDigest: other.pin.digest })
    expect(r.themeSwitch.active()).toBe(installed)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'registry' })
    expect(r.themeSwitch.status().active.id).toBe('sample')
    // A restart with the registry still down serves the installed theme from the store alone
    const restarted = await rig({ registry: fake, builtIn: r.builtIn, deployment: r.deployment })
    await restarted.themeSwitch.restore({ active: sample.pin, lastGood: null })
    expect(restarted.themeSwitch.active().runtime.id).toBe('sample')
  })

  it('refuses an install when the store is full, and a request evicts nothing', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake })
    const entries = join(r.deployment, 'v1/entries')
    for (let index = 0; index < 50; index++) mkdirSync(join(entries, index.toString(16).padStart(64, '0')), { recursive: true })
    const before = r.themeSwitch.active()
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.active()).toBe(before)
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'limit', message: expect.stringContaining('50 entries') })
    expect(readdirSync(entries)).toHaveLength(50)
    expect(downloaded(fake)).toBe(false)
  })

  it('stops starting installs after six in an hour and waits out a failed pin with a doubling backoff', async () => {
    const fake = await registry()
    const missing = packaged('missing')
    publishAll(fake, [packaged('sample')])
    const r = await rig({ registry: fake })
    const raw = { themeId: 'missing', themeVersion: '1.0.0', themeDigest: missing.pin.digest }
    await observed(r, raw)
    expect(r.themeSwitch.status().error?.rule).toBe('registry')
    const first = fake.seen.length
    // Inside the first minute the same request is not tried again
    r.clock.now += 30_000
    await observed(r, raw)
    expect(fake.seen.length).toBe(first)
    r.clock.now += 31_000
    await observed(r, raw)
    expect(fake.seen.length).toBeGreaterThan(first)
    // The wait doubled: two minutes now
    const second = fake.seen.length
    r.clock.now += 61_000
    await observed(r, raw)
    expect(fake.seen.length).toBe(second)
    // Six installs an hour, whatever pins they were for
    const many = await rig({ registry: fake })
    for (let index = 0; index < 7; index++) {
      const digest = `sha256:${index.toString(16).repeat(64).slice(0, 64)}`
      await observed(many, { themeId: `t${index}`, themeVersion: '1.0.0', themeDigest: digest })
    }
    expect(many.themeSwitch.status().error).toMatchObject({ rule: 'limit', message: expect.stringContaining('6 installs') })
  })

  it('stops an attempt after 60 seconds when the registry never answers, and keeps the current theme', async () => {
    const sample = packaged('sample')
    let asked: () => void = () => undefined
    const reached = new Promise<void>((done) => {
      asked = done
    })
    const silent = ((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      asked()
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })) as unknown as typeof fetch
    const base = await rig()
    const r = await rig({ builtIn: base.builtIn, install: { registry: signal => createRegistry({ registry: base.registry.registry, identity: TEST_IDENTITY, verifier: stubVerifier, fetch: ((url, init) => silent(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal })) as typeof fetch }) } })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const before = r.themeSwitch.active()
      r.themeSwitch.observe({ themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
      await reached
      await vi.advanceTimersByTimeAsync(59_000)
      expect(r.themeSwitch.status().error).toBeNull()
      await vi.advanceTimersByTimeAsync(1_000)
      expect(r.themeSwitch.status().error).toMatchObject({ rule: 'registry' })
      expect(r.themeSwitch.active()).toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('boot', () => {
  it('compiles a remembered theme again for a new core without a request to the registry, and does not count it toward the install limit', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const first = await rig({ registry: fake })
    await observed(first, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    const upgraded = await rig({ registry: fake, builtIn: first.builtIn, deployment: first.deployment, install: { options: { ...installFor(fake, first.deployment).options, coreBuild: 'upgraded' } } })
    const requests = fake.seen.length
    await upgraded.themeSwitch.restore({ active: sample.pin, lastGood: null })
    // Not yet compiled for the new core: nothing is active from the store
    expect(upgraded.themeSwitch.active().runtime.id).toBe('minimal')
    const { recompileStored } = await import('../modules/theme/install/recompile')
    const options = installFor(fake, first.deployment).options
    const [outcome] = await recompileStored([sample.pin], { ...options, coreBuild: 'upgraded' }, {}, bundle => installFor(fake, first.deployment).registry(AbortSignal.abort()).verify(sample.pin, bundle))
    expect(outcome?.status).toBe('recompiled')
    await upgraded.themeSwitch.restore({ active: sample.pin, lastGood: null })
    expect(upgraded.themeSwitch.active().runtime.id).toBe('sample')
    expect(fake.seen.length).toBe(requests)
    expect(upgraded.persisted).toEqual([])
  })

  it('resolves a read of the site settings made before the boot work ends only after it, without a download', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const first = await rig({ registry: fake })
    await observed(first, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    const upgraded = await rig({ registry: fake, builtIn: first.builtIn, deployment: first.deployment, install: { options: { ...installFor(fake, first.deployment).options, coreBuild: 'upgraded' } } })
    const requests = fake.seen.length
    let finish: () => void = () => undefined
    upgraded.themeSwitch.hold(new Promise<void>((done) => {
      finish = done
    }))
    // The config check reads the settings while the remembered theme is still being compiled for the new core
    upgraded.themeSwitch.observe({ themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    await new Promise(done => setTimeout(done, 50))
    expect(upgraded.themeSwitch.status().requested).toMatchObject({ id: 'sample' })
    expect(upgraded.themeSwitch.status().error).toBeNull()
    expect(fake.seen.length).toBe(requests)
    const { recompileStored } = await import('../modules/theme/install/recompile')
    const options = installFor(fake, first.deployment).options
    await recompileStored([sample.pin], { ...options, coreBuild: 'upgraded' }, {}, bundle => installFor(fake, first.deployment).registry(AbortSignal.abort()).verify(sample.pin, bundle))
    await upgraded.themeSwitch.restore({ active: sample.pin, lastGood: null })
    finish()
    await upgraded.settle()
    expect(upgraded.themeSwitch.active().runtime.id).toBe('sample')
    expect(upgraded.themeSwitch.status().error).toBeNull()
    expect(fake.seen.length).toBe(requests)
  })

  it('tries a new theme named while the server was down after the remembered one is restored, not before', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const first = await rig({ registry: fake })
    await observed(first, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    const restarted = await rig({ registry: fake, builtIn: first.builtIn, deployment: first.deployment })
    let finish: () => void = () => undefined
    restarted.themeSwitch.hold(new Promise<void>((done) => {
      finish = done
    }))
    restarted.themeSwitch.observe({ themeId: 'starter' })
    await restarted.themeSwitch.restore({ active: sample.pin, lastGood: null })
    finish()
    await restarted.settle()
    expect(restarted.themeSwitch.active().runtime.id).toBe('starter')
    expect(restarted.themeSwitch.status().error).toBeNull()
  })
})

describe('the isolated install of the server', () => {
  it('installs through the child process and activates the theme', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake, install: { run: (source, options) => installIsolated(source, options) } })
    await observed(r, { themeId: 'sample', themeVersion: '1.0.0', themeDigest: sample.pin.digest })
    expect(r.themeSwitch.status().error).toBeNull()
    expect(r.themeSwitch.active().runtime.id).toBe('sample')
  }, 60_000)
})
