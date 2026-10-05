import type { ThemeMode, ThemeModeDefinition } from '../interfaces/theme'
import { LEGACY_THEME_STORAGE_KEY, PREVIOUS_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from '../../modules/theme/init-script.mjs'

export { LEGACY_THEME_STORAGE_KEY, PREVIOUS_THEME_STORAGE_KEY, THEME_STORAGE_KEY }

export function isThemeMode(modes: ThemeModeDefinition[], value: unknown): value is ThemeMode {
  return modes.some(mode => mode.id === value)
}

/** The first mode with the scheme (the legacy `dark` | `light` color modes map through it). */
export function modeForScheme(modes: ThemeModeDefinition[], scheme: string | null): ThemeMode | null {
  return modes.find(mode => mode.scheme === scheme)?.id ?? null
}

export function schemeOf(modes: ThemeModeDefinition[], id: ThemeMode): 'dark' | 'light' {
  return modes.find(mode => mode.id === id)?.scheme ?? modes[0]?.scheme ?? 'dark'
}

export function nextMode(modes: ThemeModeDefinition[], current: ThemeMode): ThemeMode {
  const index = modes.findIndex(mode => mode.id === current)
  return modes[(index + 1) % modes.length]?.id ?? current
}

export function readStoredMode(modes: ThemeModeDefinition[]): ThemeMode | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(modes, stored) ? stored : null
  } catch {
    return null
  }
}

function removeLegacyKeys(): void {
  localStorage.removeItem(PREVIOUS_THEME_STORAGE_KEY)
  localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
}

export function storeMode(mode: ThemeMode): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
    removeLegacyKeys()
    return true
  } catch {
    return false
  }
}

/** Moves the previous keys into `bd-theme`, only while it is absent: a stored value that is not a mode is the user's, not ours to overwrite. */
export function migrateStoredMode(modes: ThemeModeDefinition[]): void {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored !== null) {
      if (isThemeMode(modes, stored)) removeLegacyKeys()
      return
    }
    const previous = localStorage.getItem(PREVIOUS_THEME_STORAGE_KEY)
    const mode = isThemeMode(modes, previous) ? previous : modeForScheme(modes, localStorage.getItem(LEGACY_THEME_STORAGE_KEY))
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
