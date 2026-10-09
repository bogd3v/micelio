import { defaultLocale } from '../interfaces/locale'
import { SITE_MODULES } from '../interfaces/site'
import type { Site, SiteImage, SiteModules, SiteSettings, SocialLink, SocialNetwork } from '../interfaces/site'

/** The `site` block of app.config.ts: the fallback when Strapi has no value. */
export interface AppSiteConfig {
  name: string
  description: string
  url: string
  author: { name: string, url: string }
  favicon?: SiteImage
  socialLinks: SocialLink[]
  support: { buyMeACoffee: string }
  privacy: { contactEmail: string, updatedAt: string }
}

export const ALL_MODULES_ON: Readonly<SiteModules> = Object.freeze(
  Object.fromEntries(SITE_MODULES.map(module => [module, true])) as SiteModules,
)

/** The site's own values, with the active theme's favicon when app.config.ts has none (ADR 0005, section 4). */
export function siteFromAppConfig(config: AppSiteConfig, themeFavicon?: string): Site {
  return {
    name: config.name,
    description: config.description,
    url: config.url,
    defaultLocale,
    author: { ...config.author },
    logo: null,
    favicon: config.favicon ? { ...config.favicon } : themeFavicon ? { url: themeFavicon } : null,
    defaultOgImage: null,
    socialLinks: config.socialLinks.map(link => ({ ...link })),
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

/** `image` with a relative URL (Strapi's local upload provider) resolved against the Strapi public URL; URLs with a scheme (http, data, blob) stay, and `//host/x` becomes `https://host/x`. */
export function resolveSiteImage(image: SiteImage | null | undefined, strapiUrl: string): SiteImage | null | undefined {
  if (!image?.url) return image
  if (image.url.startsWith('//')) return { ...image, url: `https:${image.url}` }
  if (/^[a-z][a-z\d+.-]*:/i.test(image.url) || !strapiUrl) return image
  return { ...image, url: `${strapiUrl.replace(/\/+$/, '')}/${image.url.replace(/^\/+/, '')}` }
}

/** The settings with `logo`, `favicon` and `defaultOgImage` resolved to absolute URLs (see resolveSiteImage). */
export function resolveSiteMedia(settings: SiteSettings | null | undefined, strapiUrl: string): SiteSettings | null | undefined {
  if (!settings) return settings
  return {
    ...settings,
    logo: resolveSiteImage(settings.logo, strapiUrl),
    favicon: resolveSiteImage(settings.favicon, strapiUrl),
    defaultOgImage: resolveSiteImage(settings.defaultOgImage, strapiUrl),
  }
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
    ...(settings.homePage && { homePage: { slug: settings.homePage.slug } }),
  }
}

/** `@user` from an X (or Twitter) profile link, for twitter:site. */
export function xHandle(links: readonly SocialLink[]): string | null {
  const link = links.find(item => item.network === 'x')
  const match = link?.url.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})\/?$/)
  return match ? `@${match[1]}` : null
}

/** The local part of a fediverse handle: `@blog@cms.example.org` → `@blog`. */
export function fediverseUser(handle: string): string {
  const user = handle.replace(/^@/, '').split('@')[0]
  return user ? `@${user}` : ''
}

/** How the footer lists each network. X is left out: its link only feeds twitter:site. */
export const FOOTER_SOCIALS: Readonly<Partial<Record<SocialNetwork, { label: string, abbr: string }>>> = {
  linkedin: { label: 'LinkedIn', abbr: 'in' },
  github: { label: 'GitHub', abbr: 'gh' },
  gitlab: { label: 'GitLab', abbr: 'gl' },
  codeberg: { label: 'Codeberg', abbr: 'cb' },
  mastodon: { label: 'Mastodon', abbr: 'md' },
  bluesky: { label: 'Bluesky', abbr: 'bs' },
  website: { label: 'Website', abbr: 'www' },
}

const ICON_TYPES: Readonly<Record<string, string>> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  ico: 'image/x-icon',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

/** The media type of a favicon from its file extension, or undefined to let the browser sniff it. */
export function iconType(url: string): string | undefined {
  const extension = url.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase() ?? ''
  return ICON_TYPES[extension]
}

/** A page title with the site name after it: `Blog - Micelio`. */
export function pageTitle(title: string, siteName: string): string {
  return `${title} - ${siteName}`
}

/** `url` as an absolute URL, prefixing `siteUrl` when it is a path. */
export function absoluteUrl(url: string, siteUrl: string): string {
  return /^https?:\/\//.test(url) ? url : `${siteUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

/**
 * The share image of a page without a cover: the site's `defaultOgImage` from Strapi first, then the theme's
 * `images.ogImage`, as an absolute URL; undefined when neither exists. `media` turns a Strapi media path into a URL.
 */
export function defaultOgImageUrl(
  site: Pick<Site, 'defaultOgImage'>,
  themeImage: string | undefined,
  siteUrl: string,
  media: (url: string) => string,
): string | undefined {
  if (site.defaultOgImage?.url) return media(site.defaultOgImage.url)
  return themeImage ? absoluteUrl(themeImage, siteUrl) : undefined
}

/** The logo for structured data: the site's logo, else its favicon, as an absolute URL. */
export function siteLogoUrl(site: Pick<Site, 'logo' | 'favicon'>, siteUrl: string): string | undefined {
  const url = site.logo?.url ?? site.favicon?.url
  return url ? absoluteUrl(url, siteUrl) : undefined
}

/** The author's schema.org Person, only from what the site sets; null without an author name. */
export function personStructuredData(site: Site): Record<string, unknown> | null {
  if (!site.author.name) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': site.author.name,
    ...(site.author.url && { url: site.author.url }),
    ...(site.socialLinks.length && { sameAs: site.socialLinks.map(link => link.url) }),
    'worksFor': { '@type': 'Organization', 'name': site.name },
  }
}
