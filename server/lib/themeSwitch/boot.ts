import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { cleanTemporary } from '../../../modules/theme/install/store'
import { readInstallConfig } from '../../../modules/theme/install/config'
import { BUILT_WORKER } from '../../../modules/theme/install/constants'
import { installIsolated } from '../../../modules/theme/install/isolated'
import { recompileStored } from '../../../modules/theme/install/recompile'
import { createRegistry } from '../../../modules/theme/registry/client'
import { DEFAULT_REGISTRY } from '../../../modules/theme/registry/constants'
import { identityFor } from '../../../modules/theme/registry/identity'
import { parseRegistry } from '../../../modules/theme/registry/oci'
import type { ThemePin } from '../../../modules/theme/registry/types'
import { listBuiltInThemes, loadBuiltInTheme, loadDefaultTheme, readInstallInputs } from '../builtInStore'
import type { BuiltInTheme } from '../types'
import { DOWNLOAD_TIMEOUT_MS } from './constants'
import { createGuardedFetch } from './guardedFetch'
import { createThemeSwitch } from './switch'
import { readPins, writePins } from './state'
import { readTiers } from './tiers'
import type { SwitchDeps, SwitchInstall, ThemeSwitch } from './types'

/** What `startThemeSwitch` needs from the process. */
export interface StartOptions {
  /** The folder of the built-in store (`locateBuiltInStore`). */
  builtInDir: string
  /** The runtime value of `NUXT_PUBLIC_THEME`. */
  configured: unknown
  env: Record<string, string | undefined>
  onSwitch: SwitchDeps['onSwitch']
  warn: SwitchDeps['warn']
  /** Development reads a theme from the store again on each use, since the build installs an edited one under the same id. */
  reread?: boolean
}

/** The switch of this process and the boot work that must finish before the first request. */
export interface StartedSwitch {
  themeSwitch: ThemeSwitch
  /** Cleans the store, compiles the remembered pins again for this core and activates them; never rejects. */
  ready: Promise<void>
  /** Loads the default theme again (development: the build rewrote the store's index). */
  reload: () => void
}

function installOf(options: StartOptions): SwitchInstall | null {
  const config = readInstallConfig(options.env)
  for (const line of config.warnings) options.warn('theme.store', line)
  if (config.storeDir === null) return null
  const address = options.env.MICELIO_THEME_REGISTRY?.trim() || DEFAULT_REGISTRY
  const registryHost = new URL(parseRegistry(address).origin).host
  const identity = identityFor(address, options.env)
  if (config.installEnabled && identity === null) options.warn('theme.registry', 'MICELIO_THEME_REGISTRY is not the default registry and MICELIO_THEME_REGISTRY_IDENTITY is not set: the server installs nothing from it')
  const inputs = readInstallInputs(options.builtInDir)
  const worker = join(dirname(options.builtInDir), BUILT_WORKER)
  return {
    storeDir: config.storeDir,
    enabled: config.installEnabled,
    tiers: readTiers(options.env.MICELIO_THEME_TIERS),
    options: { storeDir: config.storeDir, hooks: inputs.hooks, coreBuild: inputs.coreBuild, layoutCss: inputs.layoutCss },
    registry: signal => createRegistry({ registry: address, identity, timeoutMs: DOWNLOAD_TIMEOUT_MS, fetch: createGuardedFetch({ registryHost, signal }) }),
    run: (source, installOptions) => installIsolated(source, installOptions, existsSync(worker) ? { worker } : {}),
  }
}

/**
 * Builds the server's theme switch from the environment (ADR 0009) and starts its boot work.
 *
 * @remarks
 * Reading `MICELIO_THEME_STORE`, `MICELIO_THEME_INSTALL`, `MICELIO_THEME_REGISTRY`, its identity and `MICELIO_THEME_TIERS` happens here, synchronously,
 * so a bad value stops the boot with a message that names the variable. `ready` then removes what an interrupted install left, compiles the
 * remembered active and last good themes again for this core (from their kept packages, with no request to a registry, and not counted
 * toward the install limits), and activates them, so the first request does not render the default theme.
 *
 * @throws `Error` naming the variable when one of them is invalid, or `NUXT_PUBLIC_THEME` names a theme the image lacks.
 */
export function startThemeSwitch(options: StartOptions): StartedSwitch {
  const install = installOf(options)
  const loaded = new Map<string, BuiltInTheme>()
  const builtIn = (id: string): BuiltInTheme | undefined => {
    if (!options.reread && loaded.has(id)) return loaded.get(id)
    if (!listBuiltInThemes(options.builtInDir).some(listed => listed.id === id)) return undefined
    const theme = loadBuiltInTheme(options.builtInDir, id)
    loaded.set(id, theme)
    return theme
  }
  let listed: ReturnType<typeof listBuiltInThemes> | undefined
  let defaultTheme = loadDefaultTheme(options.builtInDir, options.configured)
  const themeSwitch = createThemeSwitch({
    now: Date.now,
    defaultTheme: () => defaultTheme,
    builtIn,
    builtInList: () => (options.reread ? listBuiltInThemes(options.builtInDir) : (listed ??= listBuiltInThemes(options.builtInDir))),
    install,
    persist: install ? pins => writePins(install.storeDir, pins) : undefined,
    onSwitch: options.onSwitch,
    warn: options.warn,
  })
  async function boot(): Promise<void> {
    if (!install) return
    try {
      await cleanTemporary(install.storeDir)
      const pins = await readPins(install.storeDir)
      const remembered = [pins.active, pins.lastGood].filter((pin): pin is ThemePin => pin !== null)
      const registry = install.registry(AbortSignal.abort())
      const worker = join(dirname(options.builtInDir), BUILT_WORKER)
      // One pin at a time: the attestation of a kept package is checked against that package's digest
      for (const pin of remembered) {
        const [outcome] = await recompileStored([pin], install.options, existsSync(worker) ? { worker } : {}, bundle => registry.verify(pin, bundle))
        if (outcome?.status === 'failed') options.warn('theme.recompile', `The remembered theme ${pin.id}@${pin.version} could not be compiled again for this core`, outcome.error)
      }
      await themeSwitch.restore(pins)
    } catch (error) {
      options.warn('theme.boot', 'The theme store could not be prepared; the site starts on the default theme', (error as Error).message.slice(0, 300))
    }
  }
  const ready = boot()
  // A read of the site settings that comes before the boot work ends (the config check does) is resolved after it
  themeSwitch.hold(ready)
  return {
    themeSwitch,
    ready,
    reload() {
      loaded.clear()
      listed = undefined
      defaultTheme = loadDefaultTheme(options.builtInDir, options.configured)
      themeSwitch.reset()
    },
  }
}
