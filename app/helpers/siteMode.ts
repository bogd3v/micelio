/** How a site is built (ADR 0006, section 1). */
export const SITE_MODES = ['dynamic', 'static', 'landing'] as const
export type SiteMode = typeof SITE_MODES[number]

export const DEFAULT_SITE_MODE: SiteMode = 'dynamic'

/** The mode for a `NUXT_PUBLIC_SITE_MODE` value: empty is `dynamic`, anything unknown throws. */
export function parseSiteMode(value: unknown): SiteMode {
  if (value === undefined || value === null) return DEFAULT_SITE_MODE
  const mode = String(value).trim()
  if (mode === '') return DEFAULT_SITE_MODE
  if ((SITE_MODES as readonly string[]).includes(mode)) return mode as SiteMode
  throw new Error(`NUXT_PUBLIC_SITE_MODE is "${mode}" but it must be one of: ${SITE_MODES.join(', ')}.`)
}

/** Static and landing sites are prerendered: no server at runtime. */
export function isStaticMode(mode: SiteMode): boolean {
  return mode === 'static' || mode === 'landing'
}
