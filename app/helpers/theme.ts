import type { ThemeMode } from '../interfaces/theme'

export const THEME_STORAGE_KEY = 'bd-theme'
export const PREVIOUS_THEME_STORAGE_KEY = 'devbog-theme'
export const LEGACY_THEME_STORAGE_KEY = 'devbog-color-mode'

const COLOR_MODE_THEMES: Record<string, ThemeMode> = { dark: 'noche', light: 'dia' }

export const themeInitScript = `(function(){var d=document.documentElement,t;try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s!=='noche'&&s!=='dia'){s=localStorage.getItem('${PREVIOUS_THEME_STORAGE_KEY}')}if(s!=='noche'&&s!=='dia'){s={dark:'noche',light:'dia'}[localStorage.getItem('${LEGACY_THEME_STORAGE_KEY}')]}t=s||(matchMedia('(prefers-color-scheme: light)').matches?'dia':'noche')}catch(e){t='noche'}d.setAttribute('data-theme',t)})()`

export function isTheme(value: unknown): value is ThemeMode {
  return value === 'noche' || value === 'dia'
}

export function readStoredTheme(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : null
  } catch {
    return null
  }
}

function removeLegacyThemes(): void {
  localStorage.removeItem(PREVIOUS_THEME_STORAGE_KEY)
  localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
}

export function storeTheme(theme: ThemeMode): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    removeLegacyThemes()
    return true
  } catch {
    return false
  }
}

export function migrateStoredTheme(): void {
  try {
    if (readStoredTheme()) {
      removeLegacyThemes()
      return
    }
    const previous = localStorage.getItem(PREVIOUS_THEME_STORAGE_KEY)
    const legacy = COLOR_MODE_THEMES[localStorage.getItem(LEGACY_THEME_STORAGE_KEY) ?? '']
    const theme = isTheme(previous) ? previous : legacy
    if (theme) storeTheme(theme)
    else removeLegacyThemes()
  } catch {
    return
  }
}

export function systemTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'dia' : 'noche'
}
