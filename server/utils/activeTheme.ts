import type { BuiltInTheme } from '../lib/types'
import type { ThemeSwitch } from '../lib/themeSwitch/types'
import type { ThemeStatus } from '~/interfaces/theme'

// The theme this process renders and serves: one switch every reader asks (ADR 0009, section 6). Created once at boot by server/plugins/builtInTheme.ts.

let current: ThemeSwitch | undefined

/** Records the switch of this process; called at boot. */
export function setThemeSwitch(themeSwitch: ThemeSwitch): void {
  current = themeSwitch
}

function themeSwitch(): ThemeSwitch {
  if (current === undefined) throw new Error('The active theme is not loaded: the built-in theme plugin has not run')
  return current
}

/** The theme the server renders now, with its verified bytes. A request keeps the one it saw first in `event.context.activeTheme`. */
export function activeTheme(): BuiltInTheme {
  return themeSwitch().active()
}

/** The theme whose files `/_t/<digest>/` may serve, or `undefined` for any other digest: the active, the last good and the ones retired within the last hour. */
export function servedTheme(digest: string): BuiltInTheme | undefined {
  return current?.served(digest)
}

/** Tells the switch what the site settings of the default language name; it switches in the background, so this never waits. */
export function observeTheme(raw: Parameters<ThemeSwitch['observe']>[0]): void {
  current?.observe(raw)
}

/** What `GET /api/theme/status` answers. */
export function themeStatus(): ThemeStatus {
  return themeSwitch().status()
}
