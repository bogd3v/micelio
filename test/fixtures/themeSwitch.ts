import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadBuiltInTheme } from '../../server/lib/builtInStore'
import { createGuardedFetch } from '../../server/lib/themeSwitch/guardedFetch'
import { createThemeSwitch } from '../../server/lib/themeSwitch/switch'
import { readTiers } from '../../server/lib/themeSwitch/tiers'
import type { PersistedPins, SwitchDeps, SwitchInstall, ThemeSwitch } from '../../server/lib/themeSwitch/types'
import type { BuiltInTheme } from '../../server/lib/types'
import { loadHooks } from '../../modules/theme/hooks'
import { INSTALL_INPUTS } from '../../modules/theme/install/constants'
import { installTheme } from '../../modules/theme/install/install'
import type { BuiltInIndex } from '../../modules/theme/install/types'
import { buildPackage } from '../../modules/theme/registry/build'
import { createRegistry } from '../../modules/theme/registry/client'
import { gzipDeterministic } from '../../modules/theme/registry/gzip'
import { writeTar } from '../../modules/theme/registry/tar'
import { unpackOwnTheme } from '../../modules/theme/registry/unpack'
import { parseRegistry } from '../../modules/theme/registry/oci'
import type { ThemePin } from '../../modules/theme/registry/types'
import { discoverThemes } from '../../modules/theme/themes'
import { digestOf, startRegistry, stubVerifier, TEST_IDENTITY } from './registry'
import type { FakeRegistry } from './registry'

// A built-in store, a deployment store and a fake registry wired to the theme switch, as the server wires them.

export const ROOT = resolve(__dirname, '../..')
export const HOOKS = loadHooks(join(ROOT, 'app'))
export const CORE = 'switch'

/** The package digest the lock of the test image pins for `starter`, as a registry's `.tgz` would have (the entry's own package digest is that of its file tree). */
export const STARTER_PINNED = `sha256:${'5'.repeat(64)}`
const temporary: string[] = []

/** A new empty directory that `cleanup` removes. */
export function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-switch-'))
  temporary.push(dir)
  return dir
}

/** Removes every directory `scratch` made. */
export function cleanup(): void {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true })
}

/** A built-in store as the build writes it: `minimal` (data only, the default) and `starter` (a code theme), the index and the install inputs. */
export async function builtInStore(): Promise<string> {
  const dir = scratch()
  const themes: BuiltInIndex['themes'] = {}
  for (const [id, folder] of [['minimal', 'test/fixtures/themes/minimal'], ['starter', 'themes/starter']] as const) {
    const result = await installTheme({ kind: 'folder', dir: join(ROOT, folder) }, { storeDir: dir, hooks: HOOKS, coreBuild: CORE, allowCode: true, buildChecksOnly: true })
    themes[id] = { digest: result.digest, version: result.manifest.version, code: result.manifest.code, ...(id === 'starter' && { pinned: STARTER_PINNED }) }
  }
  const index: BuiltInIndex = { coreBuild: CORE, buildTheme: 'minimal', themes }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index))
  writeFileSync(join(dir, INSTALL_INPUTS), JSON.stringify({ hooks: JSON.parse(readFileSync(join(ROOT, 'app/theme/hooks.json'), 'utf8')) as unknown, layoutCss: {} }))
  return dir
}

/** A packed data-only theme named `id`: a copy of the starter without its slots, with the version and `edit` applied. */
export function packaged(id: string, edit?: (dir: string) => void, version = '1.0.0'): { data: Buffer, pin: ThemePin } {
  const dir = join(scratch(), id)
  cpSync(join(ROOT, 'themes/starter'), dir, { recursive: true })
  rmSync(join(dir, 'slots'), { recursive: true })
  const file = join(dir, 'theme.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  writeFileSync(file, JSON.stringify({ ...manifest, id, version }))
  edit?.(dir)
  const built = buildPackage(discoverThemes([dir])[0]!, HOOKS)
  return { data: built.tgz, pin: { id, version, digest: built.digest } }
}

/**
 * A package changed after the packer checked it, as a registry that runs no admission could publish: `edit` receives the unpacked files.
 * The pin names the digest of the new bytes.
 */
export function repacked(pkg: { data: Buffer, pin: ThemePin }, edit: (files: Map<string, Uint8Array>) => void): { data: Buffer, pin: ThemePin } {
  const files = new Map(unpackOwnTheme(pkg.data).files)
  edit(files)
  const data = gzipDeterministic(writeTar([...files].map(([path, bytes]) => ({ path, data: bytes }))))
  return { data, pin: { ...pkg.pin, digest: digestOf(data) } }
}

/** The index entry the registry lists for a version. */
export function listing(digest: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
  return { digest, contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false, ...fields }
}

/** Publishes the packages and an index that lists them all as `published` (or as `fields` say). */
export function publishAll(fake: FakeRegistry, packages: Array<{ data: Buffer, pin: ThemePin }>, fields: Record<string, Record<string, unknown>> = {}): void {
  const themes: Record<string, { versions: Record<string, unknown> }> = {}
  for (const { data, pin } of packages) {
    fake.publish(pin.id, pin.version, data)
    themes[pin.id] = { versions: { ...themes[pin.id]?.versions, [pin.version]: listing(digestOf(data), fields[pin.id]) } }
  }
  fake.publishIndex({ version: 1, themes })
}

/** Everything a test of the switch reads back. */
export interface Rig {
  themeSwitch: ThemeSwitch
  builtIn: string
  deployment: string
  registry: FakeRegistry
  warnings: string[]
  /** The pairs of digests `onSwitch` was called with. */
  switches: Array<{ from: string, to: string }>
  persisted: PersistedPins[]
  clock: { now: number }
  /** Waits until no switch is running. */
  settle: () => Promise<void>
}

/** The `install` the server builds, over a fake registry and the in-process installer. */
export function installFor(registry: FakeRegistry, deployment: string, overrides: Partial<SwitchInstall> = {}): SwitchInstall {
  const registryHost = new URL(parseRegistry(registry.registry).origin).host
  return {
    storeDir: deployment,
    enabled: true,
    tiers: readTiers(undefined),
    options: { storeDir: deployment, hooks: HOOKS, coreBuild: CORE, layoutCss: {} },
    registry: signal => createRegistry({ registry: registry.registry, identity: TEST_IDENTITY, verifier: stubVerifier, fetch: createGuardedFetch({ registryHost, signal }) }),
    run: (source, options) => installTheme(source, options),
    ...overrides,
  }
}

/** A switch over the stores of a rig, started on `minimal`. */
export async function rig(options: { install?: Partial<SwitchInstall> | null, builtIn?: string, deployment?: string, registry?: FakeRegistry, deps?: Partial<SwitchDeps> } = {}): Promise<Rig> {
  const builtIn = options.builtIn ?? await builtInStore()
  const deployment = options.deployment ?? scratch()
  const registry = options.registry ?? await startRegistry()
  const warnings: string[] = []
  const switches: Rig['switches'] = []
  const persisted: PersistedPins[] = []
  const clock = { now: Date.UTC(2026, 9, 30) }
  const index = JSON.parse(readFileSync(join(builtIn, 'index.json'), 'utf8')) as BuiltInIndex
  const cache = new Map<string, BuiltInTheme>()
  const themeSwitch = createThemeSwitch({
    now: () => clock.now,
    defaultTheme: () => load('minimal'),
    builtIn: id => (Object.hasOwn(index.themes, id) ? load(id) : undefined),
    builtInList: () => Object.entries(index.themes).map(([id, listed]) => ({ id, version: listed.version, code: listed.code })),
    install: options.install === null ? null : installFor(registry, deployment, options.install),
    persist: (pins) => {
      persisted.push(pins)
      return Promise.resolve()
    },
    onSwitch: ({ from, to }) => switches.push({ from: from.runtime.digest, to: to.runtime.digest }),
    warn: (event, message, cause) => warnings.push([event, message, cause].filter(Boolean).join(': ')),
    ...options.deps,
  })
  function load(id: string): BuiltInTheme {
    let theme = cache.get(id)
    if (!theme) {
      theme = loadBuiltInTheme(builtIn, id)
      cache.set(id, theme)
    }
    return theme
  }
  return { themeSwitch, builtIn, deployment, registry, warnings, switches, persisted, clock, settle: () => themeSwitch.settled(60_000) }
}
