import type { BuiltInTheme } from '../lib/builtInStore'

// The theme this process renders and serves. Set once at boot by server/plugins/builtInTheme.ts.

let active: BuiltInTheme | undefined

/** Records the theme the server renders; called at boot. */
export function setActiveTheme(theme: BuiltInTheme): void {
  active = theme
}

/** The theme the server renders, with its verified bytes. */
export function activeTheme(): BuiltInTheme {
  if (active === undefined) throw new Error('The active theme is not loaded: the built-in theme plugin has not run')
  return active
}

/**
 * The theme whose files `/_t/<digest>/` may serve, or `undefined` for any other digest.
 *
 * @remarks
 * Only the active theme for now; the last good and locked themes and the previous digests of a switch join it with #403.
 */
export function servedTheme(digest: string): BuiltInTheme | undefined {
  return active?.runtime.digest === digest ? active : undefined
}
