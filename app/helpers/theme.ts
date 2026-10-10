import type { ThemeMode, ThemeModeDefinition } from '../interfaces/theme'
import { BD_THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY, PREVIOUS_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from '../../modules/theme/init-script.mjs'

export { LEGACY_THEME_STORAGE_KEY, PREVIOUS_THEME_STORAGE_KEY, THEME_STORAGE_KEY }

/** Whether a value is the id of one of the theme `modes`. */
export function isThemeMode(modes: ThemeModeDefinition[], value: unknown): value is ThemeMode {
  return modes.some(mode => mode.id === value)
}

/** The first mode with the scheme (the legacy `dark` | `light` color modes map through it). */
export function modeForScheme(modes: ThemeModeDefinition[], scheme: string | null): ThemeMode | null {
  return modes.find(mode => mode.scheme === scheme)?.id ?? null
}

/**
 * The colour scheme, `dark` or `light`, of a theme mode.
 *
 * @remarks
 * An unknown mode takes the scheme of the first mode, and `dark` when there are no modes.
 */
export function schemeOf(modes: ThemeModeDefinition[], id: ThemeMode): 'dark' | 'light' {
  return modes.find(mode => mode.id === id)?.scheme ?? modes[0]?.scheme ?? 'dark'
}

/**
 * The mode after `current` in the list, wrapping around to the first mode.
 *
 * @remarks
 * A `current` that is not in the list moves to the first mode. The `current` mode is returned when there are no modes.
 */
export function nextMode(modes: ThemeModeDefinition[], current: ThemeMode): ThemeMode {
  const index = modes.findIndex(mode => mode.id === current)
  return modes[(index + 1) % modes.length]?.id ?? current
}

/** The mode saved in the browser, or null when none is saved, the saved value is not one of the `modes`, or storage is unavailable. */
export function readStoredMode(modes: ThemeModeDefinition[]): ThemeMode | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(modes, stored) ? stored : null
  } catch {
    return null
  }
}

function removeLegacyKeys(): void {
  localStorage.removeItem(BD_THEME_STORAGE_KEY)
  localStorage.removeItem(PREVIOUS_THEME_STORAGE_KEY)
  localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
}

/** Saves a mode in the browser and removes the keys of earlier versions. Returns false when storage is unavailable. */
export function storeMode(mode: ThemeMode): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
    removeLegacyKeys()
    return true
  } catch {
    return false
  }
}

/**
 * Moves the previous keys (`bd-theme`, `devbog-theme`, `devbog-color-mode`, in that order) into `micelio-theme`, only while it is absent:
 * a stored value that is not a mode is the user's, not ours to overwrite.
 */
export function migrateStoredMode(modes: ThemeModeDefinition[]): void {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored !== null) {
      if (isThemeMode(modes, stored)) removeLegacyKeys()
      return
    }
    // TODO(#422): remove the bd-theme fallback
    const bd = localStorage.getItem(BD_THEME_STORAGE_KEY)
    const previous = localStorage.getItem(PREVIOUS_THEME_STORAGE_KEY)
    const mode = isThemeMode(modes, bd) ? bd : isThemeMode(modes, previous) ? previous : modeForScheme(modes, localStorage.getItem(LEGACY_THEME_STORAGE_KEY))
    if (mode) storeMode(mode)
    else removeLegacyKeys()
  } catch {
    return
  }
}

/** First mode whose scheme matches the system preference, else the first mode. */
export function systemMode(modes: ThemeModeDefinition[]): ThemeMode {
  const scheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  return modeForScheme(modes, scheme) ?? modes[0]?.id ?? ''
}

/** Mode names as a sentence ("Night or Day"), for the privacy inventory. */
export function formatModeList(labels: string[], locale: string): string {
  return new Intl.ListFormat(locale, { type: 'disjunction' }).format(labels)
}
