/** The key of the visitor's stored mode. */
export const THEME_STORAGE_KEY: string
/** The `<html>` attribute that lists the active theme's modes as `id:scheme` pairs. */
export const MODES_ATTRIBUTE: string
/** The theme-independent inline script that picks the mode before first paint. */
export function buildInitScript(): string
