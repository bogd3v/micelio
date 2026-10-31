import { afterEach, describe, expect, it } from 'vitest'
import { startThemeSwitch } from '../server/lib/themeSwitch/boot'
import { writePins } from '../server/lib/themeSwitch/state'
import { installTheme } from '../modules/theme/install/install'
import { startRegistry, TEST_IDENTITY } from './fixtures/registry'
import type { FakeRegistry } from './fixtures/registry'
import { builtInStore, cleanup, CORE, HOOKS, packaged, scratch, STARTER_PINNED } from './fixtures/themeSwitch'

const registries: FakeRegistry[] = []

afterEach(async () => {
  await Promise.all(registries.splice(0).map(fake => fake.close()))
  cleanup()
})

async function start(env: Record<string, string>, warnings: string[] = []): Promise<ReturnType<typeof startThemeSwitch>> {
  const builtInDir = await builtInStore()
  const started = startThemeSwitch({ builtInDir, configured: '', env, onSwitch: () => undefined, warn: (event, message, cause) => warnings.push([event, message, cause].filter(Boolean).join(': ')) })
  await started.ready
  return started
}

describe('startThemeSwitch', () => {
  it('stops the boot, naming the variable, for a value it cannot use', async () => {
    const store = scratch()
    const bad: Array<[Record<string, string>, RegExp]> = [
      [{ MICELIO_THEME_STORE: 'relative/path' }, /MICELIO_THEME_STORE must be an absolute path/],
      [{ MICELIO_THEME_STORE: store, MICELIO_THEME_INSTALL: 'perhaps' }, /MICELIO_THEME_INSTALL must be/],
      [{ MICELIO_THEME_STORE: store, MICELIO_THEME_TIERS: 'official,gold' }, /MICELIO_THEME_TIERS names an unknown tier "gold"/],
      [{ MICELIO_THEME_STORE: store, MICELIO_THEME_REGISTRY: 'Not A Registry' }, /MICELIO_THEME_REGISTRY/],
      [{ MICELIO_THEME_STORE: store, MICELIO_THEME_REGISTRY: 'registry.example.test/themes', MICELIO_THEME_REGISTRY_IDENTITY: 'nonsense' }, /MICELIO_THEME_REGISTRY_IDENTITY/],
    ]
    for (const [env, message] of bad) {
      const builtInDir = await builtInStore()
      expect(() => startThemeSwitch({ builtInDir, configured: '', env, onSwitch: () => undefined, warn: () => undefined }), JSON.stringify(env)).toThrow(message)
    }
  })

  it('without a store warns once that installing has no effect, and installs nothing', async () => {
    const warnings: string[] = []
    const started = await start({ MICELIO_THEME_INSTALL: 'true' }, warnings)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('MICELIO_THEME_STORE')
    expect(started.themeSwitch.status().available.registry).toEqual({ install: false, tiers: [] })
    expect(started.themeSwitch.active().runtime.id).toBe('minimal')
  })

  it('warns when a registry other than the default has no signer identity', async () => {
    const warnings: string[] = []
    await start({ MICELIO_THEME_STORE: scratch(), MICELIO_THEME_REGISTRY: 'registry.example.test/themes' }, warnings)
    expect(warnings.join('\n')).toContain('MICELIO_THEME_REGISTRY_IDENTITY')
  })

  it('does not activate a remembered theme whose attestation does not verify, and says so', async () => {
    const fake = await startRegistry()
    registries.push(fake)
    const store = scratch()
    const sample = packaged('sample')
    // Kept by an earlier boot with a bundle that the real offline verifier does not accept
    await installTheme({ kind: 'package', ...sample, attestation: Buffer.from('{"not":"a bundle"}') }, { storeDir: store, hooks: HOOKS, coreBuild: 'older', layoutCss: {} })
    await writePins(store, { active: sample.pin, lastGood: null })
    const warnings: string[] = []
    const identity = `issuer=${TEST_IDENTITY.issuer},package=${TEST_IDENTITY.packages},index=${TEST_IDENTITY.index}`
    const started = await start({ MICELIO_THEME_STORE: store, MICELIO_THEME_REGISTRY: fake.registry, MICELIO_THEME_REGISTRY_IDENTITY: identity }, warnings)
    expect(started.themeSwitch.active().runtime.id).toBe('minimal')
    expect(warnings.join('\n')).toContain('could not be compiled again for this core')
    expect(fake.seen).toEqual([])
    expect(CORE).toBe('switch')
  })

  it('resolves a read of the site settings that comes before the boot work ends after the remembered theme is restored', async () => {
    const store = scratch()
    await writePins(store, { active: { id: 'starter', version: '1.0.0', digest: STARTER_PINNED }, lastGood: null })
    const builtInDir = await builtInStore()
    const started = startThemeSwitch({ builtInDir, configured: '', env: { MICELIO_THEME_STORE: store, MICELIO_THEME_INSTALL: 'false' }, onSwitch: () => undefined, warn: () => undefined })
    // The config check at plugin load reads the settings, which name no theme, before `ready`
    started.themeSwitch.observe({})
    await started.ready
    await started.themeSwitch.settled(5_000)
    expect(started.themeSwitch.active().runtime.id).toBe('minimal')
    expect(started.themeSwitch.status().error).toBeNull()
  })
})
