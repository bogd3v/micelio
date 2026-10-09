export const THEME_STORAGE_KEY: string
/** The pre-rename theme key: read and removed, never written. */
export const BD_THEME_STORAGE_KEY: string
export const PREVIOUS_THEME_STORAGE_KEY: string
export const LEGACY_THEME_STORAGE_KEY: string
export function buildInitScript(modes: Array<{ id: string, scheme: 'dark' | 'light' }>): string
