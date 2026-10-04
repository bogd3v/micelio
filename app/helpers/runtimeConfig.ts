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

/** The NUXT_* names of required settings that are empty. */
export function missingRuntimeSettings(config: CheckedRuntimeConfig): string[] {
  return [...missing(config, REQUIRED_RUNTIME_SETTINGS), ...missing(config.public, REQUIRED_PUBLIC_RUNTIME_SETTINGS)]
}

/** The NUXT_* names of optional settings that are empty, so the startup log can say what is off. */
export function missingOptionalRuntimeSettings(config: CheckedRuntimeConfig): string[] {
  return [...missing(config, OPTIONAL_RUNTIME_SETTINGS), ...missing(config.public, OPTIONAL_PUBLIC_RUNTIME_SETTINGS)]
}
