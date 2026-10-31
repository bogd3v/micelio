import type { BuiltInTheme } from '../types'
import type { ThemeStatus } from '~/interfaces/theme'
import type { ThemePin, ThemeRegistry } from '../../../modules/theme/registry/types'
import type { InstallOptions, InstallResult, InstallSource } from '../../../modules/theme/install/types'

/** How a server install is wired; present only when `MICELIO_THEME_STORE` is set. */
export interface SwitchInstall {
  storeDir: string
  /** `MICELIO_THEME_INSTALL`. */
  enabled: boolean
  /** The tiers a package may have (`MICELIO_THEME_TIERS`). */
  tiers: ReadonlySet<string>
  /** What `installTheme` needs besides the source: hooks, the core build and the variant CSS, never `allowCode`. */
  options: InstallOptions
  /** A registry client for one attempt, whose requests stop with `signal` (the download deadline). */
  registry: (signal: AbortSignal) => ThemeRegistry
  /** Runs an install in the isolated process; tests run it in this one. */
  run: (source: InstallSource, options: InstallOptions) => Promise<InstallResult>
}

/** The pins a store remembers across restarts. */
export interface PersistedPins {
  active: ThemePin | null
  lastGood: ThemePin | null
}

/** What the switch needs from the process around it. */
export interface SwitchDeps {
  now: () => number
  /** The instance's default theme (`NUXT_PUBLIC_THEME`). */
  defaultTheme: () => BuiltInTheme
  /** A theme of the built-in store by id, or `undefined`. */
  builtIn: (id: string) => BuiltInTheme | undefined
  builtInList: () => Array<{ id: string, version: string, code: boolean }>
  install: SwitchInstall | null
  /** Called after a switch with the pins to remember; a failure is logged by the caller. */
  persist?: (pins: PersistedPins) => Promise<void>
  /** Called once per successful switch, before any request can see the new theme (the page cache and the site cache are dropped here). */
  onSwitch: (change: { from: BuiltInTheme, to: BuiltInTheme }) => void
  /** Logs a refused switch or a failed persist; `message` is fixed text and `cause` a reason already free of URLs and paths. */
  warn: (event: string, message: string, cause?: string) => void
}

/** The server's one source of truth for the theme every request renders. */
export interface ThemeSwitch {
  /** The theme new requests render. */
  active: () => BuiltInTheme
  /** The theme whose files `/_t/<digest>/` may serve, or `undefined`: the active, the last good and the ones retired in the last hour. */
  served: (digest: string) => BuiltInTheme | undefined
  /** Reads the theme the site settings name; never waits for the network, the switch happens in the background. */
  observe: (raw: { themeId?: string, themeVersion?: string, themeDigest?: string } | null | undefined) => void
  /** Holds the background work of `observe` until `until` settles (the boot work that restores the remembered themes); what the settings ask for is recorded meanwhile. `until` must not reject. */
  hold: (until: Promise<void>) => void
  /** Activates the pins a store remembered, from what is already on this machine. */
  restore: (pins: PersistedPins) => Promise<void>
  /** Development: the build installed a theme again, so start over from the default theme and read the site settings again. */
  reset: () => void
  /** Resolves when no switch is running, or after `timeoutMs`. */
  settled: (timeoutMs: number) => Promise<void>
  status: () => ThemeStatus
}
