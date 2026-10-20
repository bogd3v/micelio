import { afterEach, describe, expect, it, vi } from 'vitest'
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadHooks } from '../modules/theme/hooks'
import { compileKey } from '../modules/theme/install/compile'
import { readInstallConfig } from '../modules/theme/install/config'
import { installedEntry, installTheme } from '../modules/theme/install/install'
import { recompileStored } from '../modules/theme/install/recompile'
import { pruneStore } from '../modules/theme/install/store'
import type { InstallOptions } from '../modules/theme/install/types'
import { buildPackage } from '../modules/theme/registry/build'
import { discoverThemes } from '../modules/theme/themes'

const ROOT = resolve(__dirname, '..')
const HOOKS = loadHooks(join(ROOT, 'app'))
const temporary: string[] = []

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-boot-'))
  temporary.push(dir)
  return dir
}

function options(storeDir: string, coreBuild: string): InstallOptions {
  return { storeDir, hooks: HOOKS, coreBuild }
}

/** A data-only copy of the starter, packed; `edit` changes it first so two themes differ. */
function packaged(edit?: (dir: string) => void): { data: Buffer, pin: { id: string, version: string, digest: string } } {
  const dir = join(scratch(), 'starter')
  cpSync(join(ROOT, 'themes/starter'), dir, { recursive: true })
  rmSync(join(dir, 'slots'), { recursive: true })
  edit?.(dir)
  const built = buildPackage(discoverThemes([dir])[0]!, HOOKS)
  return { data: built.tgz, pin: { id: 'starter', version: built.manifest.version, digest: built.digest } }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('readInstallConfig', () => {
  it('has no store and installs nothing when the store is unset, with one warning that names both variables', () => {
    const config = readInstallConfig({})
    expect(config).toMatchObject({ storeDir: null, installEnabled: false })
    expect(config.warnings).toHaveLength(1)
    expect(config.warnings[0]).toContain('MICELIO_THEME_INSTALL')
    expect(config.warnings[0]).toContain('MICELIO_THEME_STORE')
    expect(readInstallConfig({ MICELIO_THEME_INSTALL: 'true', MICELIO_THEME_STORE: '' }).installEnabled).toBe(false)
  })

  it('installs by default once there is a store, and the switch turns it off', () => {
    expect(readInstallConfig({ MICELIO_THEME_STORE: '/srv/themes' })).toEqual({ storeDir: '/srv/themes', installEnabled: true, warnings: [] })
    for (const value of ['false', '0', 'FALSE']) expect(readInstallConfig({ MICELIO_THEME_STORE: '/srv/themes', MICELIO_THEME_INSTALL: value }).installEnabled).toBe(false)
    for (const value of ['true', '1', '', ' True ']) expect(readInstallConfig({ MICELIO_THEME_STORE: '/srv/themes', MICELIO_THEME_INSTALL: value }).installEnabled).toBe(true)
  })

  it('stops with a message that names the variable for a relative store or an unknown switch', () => {
    expect(() => readInstallConfig({ MICELIO_THEME_STORE: 'themes' })).toThrow('MICELIO_THEME_STORE must be an absolute path')
    expect(() => readInstallConfig({ MICELIO_THEME_STORE: '/srv/themes', MICELIO_THEME_INSTALL: 'yes' })).toThrow('MICELIO_THEME_INSTALL must be')
    expect(() => readInstallConfig({ MICELIO_THEME_INSTALL: 'maybe' })).toThrow('MICELIO_THEME_INSTALL')
  })
})

describe('recompileStored', () => {
  it('compiles a kept package again after a core upgrade, with no registry, and then finds it current', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const store = scratch()
    const { data, pin } = packaged()
    await installTheme({ kind: 'package', data, pin, attestation: Buffer.from('{"bundle":true}') }, options(store, 'old'))
    expect(await installedEntry(store, pin, 'new')).toBeNull()
    expect(await recompileStored([pin], options(store, 'new'))).toEqual([{ pin, status: 'recompiled' }])
    expect(await installedEntry(store, pin, 'new')).not.toBeNull()
    expect(await installedEntry(store, pin, 'old')).not.toBeNull()
    expect(await recompileStored([pin], options(store, 'new'))).toEqual([{ pin, status: 'current' }])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a pin with no kept package, an invalid pin, and a bundle that does not verify, without throwing', async () => {
    const store = scratch()
    const { data, pin } = packaged()
    const other = packaged(dir => writeFileSync(join(dir, 'theme.css'), '.other{color:red}')).pin
    await installTheme({ kind: 'package', data, pin, attestation: Buffer.from('bundle') }, options(store, 'old'))
    const outcomes = await recompileStored([other, { ...pin, id: '../x' }, pin], options(store, 'new'), {}, () => {
      throw new Error('bad bundle with /secret/path')
    })
    expect(outcomes.map(outcome => outcome.status)).toEqual(['missing', 'failed', 'failed'])
    expect(outcomes[1]!.error).toBe('invalid pin')
    expect(outcomes[2]!.error).not.toContain('/secret/path')
    expect(await installedEntry(store, pin, 'new')).toBeNull()
  })

  it('requires the kept bundle when it is asked to verify', async () => {
    const store = scratch()
    const { data, pin } = packaged()
    await installTheme({ kind: 'package', data, pin }, options(store, 'old'))
    const [outcome] = await recompileStored([pin], options(store, 'new'), {}, () => undefined)
    expect(outcome).toMatchObject({ status: 'failed', error: expect.stringContaining('no attestation') })
  })
})

describe('pruneStore', () => {
  it('removes entries of other compile keys and the packages nothing uses, and keeps the pinned ones', async () => {
    const store = scratch()
    const current = packaged()
    const stale = packaged(dir => writeFileSync(join(dir, 'theme.css'), '.stale{color:red}'))
    const locked = packaged(dir => writeFileSync(join(dir, 'theme.css'), '.locked{color:red}'))
    await installTheme({ kind: 'package', ...current }, options(store, 'old'))
    await installTheme({ kind: 'package', ...current }, options(store, 'new'))
    await installTheme({ kind: 'package', ...stale }, options(store, 'old'))
    await installTheme({ kind: 'package', ...locked }, options(store, 'old'))
    const removed = await pruneStore(store, compileKey('new'), new Set([locked.pin.digest]))
    expect(removed.entries).toHaveLength(3)
    expect(removed.packages).toEqual([stale.pin.digest])
    expect(await installedEntry(store, current.pin, 'new')).not.toBeNull()
    expect(await installedEntry(store, current.pin, 'old')).toBeNull()
    expect(readdirSync(join(store, 'v1/entries'))).toHaveLength(1)
    expect(existsSync(join(store, 'v1/packages', locked.pin.digest.slice(7)))).toBe(true)
  })

  it('removes an entry whose manifest cannot be read and does nothing for an empty store', async () => {
    const store = scratch()
    expect(await pruneStore(store, compileKey('new'), new Set())).toEqual({ entries: [], packages: [] })
    const { data, pin } = packaged()
    const result = await installTheme({ kind: 'package', data, pin }, options(store, 'new'))
    writeFileSync(join(store, 'v1/entries', result.digest, 'manifest.json'), 'not json')
    expect((await pruneStore(store, compileKey('new'), new Set())).entries).toEqual([result.digest])
  })
})
