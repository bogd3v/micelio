import { defaultLocale } from '../interfaces/locale'
import { SITE_MODULES, SOCIAL_NETWORKS } from '../interfaces/site'
import type { Site, SiteModules, SiteSettings, SocialLink, SocialNetwork } from '../interfaces/site'

/** The `site` block of app.config.ts: the fallback when Strapi has no value. */
export interface AppSiteConfig {
  name: string
  description: string
  url: string
  author: { name: string, url: string }
  social: Partial<Record<SocialNetwork, string>>
  support: { buyMeACoffee: string }
  privacy: { contactEmail: string, updatedAt: string }
}

export const ALL_MODULES_ON: Readonly<SiteModules> = Object.freeze(
  Object.fromEntries(SITE_MODULES.map(module => [module, true])) as SiteModules,
)

export function siteFromAppConfig(config: AppSiteConfig): Site {
  const socialLinks: SocialLink[] = SOCIAL_NETWORKS
    .filter(network => config.social[network])
    .map(network => ({ network, url: config.social[network] as string }))
  return {
    name: config.name,
    description: config.description,
    url: config.url,
    defaultLocale,
    author: { ...config.author },
    logo: null,
    favicon: null,
    defaultOgImage: null,
    socialLinks,
    contactEmail: config.privacy.contactEmail,
    privacyContactEmail: config.privacy.contactEmail,
    privacyUpdatedAt: config.privacy.updatedAt,
    supportHandle: config.support.buyMeACoffee,
    modules: { ...ALL_MODULES_ON },
  }
}

function present<T>(value: T | undefined | null): value is T {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  return true
}

function pick<T>(value: T | undefined | null, fallback: T): T {
  return present(value) ? value : fallback
}

/** Strapi's values over the defaults, field by field: an empty or missing field keeps the default. */
export function mergeSite(defaults: Site, settings: SiteSettings | null | undefined): Site {
  if (!settings) return defaults
  return {
    name: pick(settings.name, defaults.name),
    description: pick(settings.description, defaults.description),
    url: pick(settings.url, defaults.url),
    defaultLocale: pick(settings.defaultLocale, defaults.defaultLocale),
    author: {
      name: pick(settings.author?.name, defaults.author.name),
      url: pick(settings.author?.url, defaults.author.url),
    },
    logo: pick(settings.logo, defaults.logo),
    favicon: pick(settings.favicon, defaults.favicon),
    defaultOgImage: pick(settings.defaultOgImage, defaults.defaultOgImage),
    socialLinks: pick(settings.socialLinks, defaults.socialLinks),
    contactEmail: pick(settings.contactEmail, defaults.contactEmail),
    privacyContactEmail: pick(settings.privacyContactEmail, defaults.privacyContactEmail),
    privacyUpdatedAt: pick(settings.privacyUpdatedAt, defaults.privacyUpdatedAt),
    supportHandle: pick(settings.supportHandle, defaults.supportHandle),
    modules: Object.fromEntries(
      SITE_MODULES.map(module => [module, pick(settings.modules?.[module], defaults.modules[module])]),
    ) as SiteModules,
  }
}
