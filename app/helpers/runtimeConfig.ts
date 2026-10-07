import type { ModuleRequirements } from './modules'
import { validFormAction } from './newsletterForm'
import { isStaticMode, parseSiteMode } from './siteMode'
import type { SiteMode } from './siteMode'

export const REQUIRED_RUNTIME_SETTINGS = {
  strapiApiToken: 'NUXT_STRAPI_API_TOKEN',
  smtpHost: 'NUXT_SMTP_HOST',
  smtpUser: 'NUXT_SMTP_USER',
  smtpPass: 'NUXT_SMTP_PASS',
  newsletterFrom: 'NUXT_NEWSLETTER_FROM',
} as const

export const REQUIRED_PUBLIC_RUNTIME_SETTINGS = {
  strapiUrl: 'NUXT_PUBLIC_STRAPI_URL',
  siteUrl: 'NUXT_PUBLIC_SITE_URL',
} as const

/** Empty is allowed: the feature they serve is left out. */
export const OPTIONAL_RUNTIME_SETTINGS = {
  mediaUrl: 'NUXT_MEDIA_URL',
} as const

export const OPTIONAL_PUBLIC_RUNTIME_SETTINGS = {
  fediverseHandle: 'NUXT_PUBLIC_FEDIVERSE_HANDLE',
  fediverseActorUrl: 'NUXT_PUBLIC_FEDIVERSE_ACTOR_URL',
  fediverseArticlesUrl: 'NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL',
} as const

export type RequiredRuntimeSetting = keyof typeof REQUIRED_RUNTIME_SETTINGS

export interface CheckedRuntimeConfig {
  [key: string]: unknown
  public?: Record<string, unknown>
}

function empty(value: unknown): boolean {
  return typeof value !== 'string' || !value.trim()
}

function missing(values: Record<string, unknown> | undefined, names: Record<string, string>): string[] {
  return Object.entries(names).filter(([key]) => empty(values?.[key])).map(([, name]) => name)
}

/** A runtime string with blanks as unset. */
function trimmed(value: unknown): unknown {
  if (typeof value !== 'string') return value
  return value.trim() || undefined
}

/** The error message when the runtime theme is not the one the build used, or null when they agree. */
export function themeMismatch(config: CheckedRuntimeConfig, buildTheme: string): string | null {
  const runtime = trimmed(config.public?.theme)
  if (runtime === buildTheme) return null
  return `NUXT_PUBLIC_THEME is "${String(runtime)}" at runtime but the build used "${buildTheme}". The theme is chosen at build time: rebuild with the value you want.`
}

/** The error message when the runtime site mode is not the one the build used, or null when they agree. */
export function modeMismatch(config: CheckedRuntimeConfig, buildMode: SiteMode): string | null {
  const runtime = config.public?.siteMode
  try {
    // Blank is unset, which is the dynamic mode
    if (parseSiteMode(runtime) === buildMode) return null
  } catch {
    // Unknown value: reported below
  }
  return `NUXT_PUBLIC_SITE_MODE is "${String(runtime)}" at runtime but the build used "${buildMode}". The mode is chosen at build time: rebuild with the value you want.`
}

/** The NUXT_* names of required settings that are empty; SMTP is not needed in static modes. */
export function missingRuntimeSettings(config: CheckedRuntimeConfig, mode: SiteMode = 'dynamic'): string[] {
  const { strapiApiToken } = REQUIRED_RUNTIME_SETTINGS
  const names = isStaticMode(mode) ? { strapiApiToken } : REQUIRED_RUNTIME_SETTINGS
  return [...missing(config, names), ...missing(config.public, REQUIRED_PUBLIC_RUNTIME_SETTINGS)]
}

/** The NUXT_* names of optional settings that are empty, so the startup log can say what is off; the fediverse ones are not needed in static modes. */
export function missingOptionalRuntimeSettings(config: CheckedRuntimeConfig, mode: SiteMode = 'dynamic'): string[] {
  return [...missing(config, OPTIONAL_RUNTIME_SETTINGS), ...(isStaticMode(mode) ? [] : missing(config.public, OPTIONAL_PUBLIC_RUNTIME_SETTINGS))]
}

const SMTP_SETTINGS = ['smtpHost', 'smtpUser', 'smtpPass', 'newsletterFrom'] as const

/** Whether the server has what the newsletter (SMTP or external form) and fediverse modules need. */
export function moduleRequirements(config: CheckedRuntimeConfig): ModuleRequirements {
  return {
    smtp: SMTP_SETTINGS.every(key => !empty(config[key])),
    fediverse: missing(config.public, OPTIONAL_PUBLIC_RUNTIME_SETTINGS).length === 0,
    formAction: validFormAction(config.public?.newsletterFormAction) !== '',
  }
}
