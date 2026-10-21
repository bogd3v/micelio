import type { ModuleRequirements } from './modules'
import type { SiteModules, SiteMode } from '../interfaces/site'
import { isStaticMode, parseSiteMode } from './siteMode'

const REQUIRED_RUNTIME_SETTINGS = {
  strapiApiToken: 'NUXT_STRAPI_API_TOKEN',
} as const

const REQUIRED_PUBLIC_RUNTIME_SETTINGS = {
  strapiUrl: 'NUXT_PUBLIC_STRAPI_URL',
  siteUrl: 'NUXT_PUBLIC_SITE_URL',
} as const

/** Empty is allowed: the feature they serve is left out. */
const OPTIONAL_RUNTIME_SETTINGS = {
  mediaUrl: 'NUXT_MEDIA_URL',
} as const

const OPTIONAL_PUBLIC_RUNTIME_SETTINGS = {
  fediverseHandle: 'NUXT_PUBLIC_FEDIVERSE_HANDLE',
  fediverseActorUrl: 'NUXT_PUBLIC_FEDIVERSE_ACTOR_URL',
  fediverseArticlesUrl: 'NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL',
} as const

interface CheckedRuntimeConfig {
  [key: string]: unknown
  public?: Record<string, unknown>
}

function empty(value: unknown): boolean {
  return typeof value !== 'string' || !value.trim()
}

function missing(values: Record<string, unknown> | undefined, names: Record<string, string>): string[] {
  return Object.entries(names).filter(([key]) => empty(values?.[key])).map(([, name]) => name)
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

/**
 * The NUXT_* names of required settings that are empty, so the server can refuse to boot.
 *
 * @remarks
 * The SMTP settings are not here: without them the newsletter is turned off (`moduleRequirements`).
 */
export function missingRuntimeSettings(config: CheckedRuntimeConfig): string[] {
  return [...missing(config, REQUIRED_RUNTIME_SETTINGS), ...missing(config.public, REQUIRED_PUBLIC_RUNTIME_SETTINGS)]
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
    formAction: !empty((config.public?.newsletterProvider as { action?: unknown } | undefined)?.action),
  }
}

/** Modules that collect personal data, which the privacy page tells visitors to write about. */
const DATA_MODULES = ['newsletter', 'comments', 'accounts'] as const

/** The warning for a site that collects data but has no privacy contact email; null when it does, when no such module is on, or when the site did not load from Strapi. */
export function privacyContactWarning(site: { privacyContactEmail: string, modules: SiteModules }, fromStrapi: boolean): string | null {
  if (!fromStrapi || site.privacyContactEmail.trim()) return null
  const on = DATA_MODULES.filter(module => site.modules[module])
  if (!on.length) return null
  return `Site setting privacyContactEmail is empty while ${on.join(', ')} collect personal data: the privacy page shows no contact address.`
}
