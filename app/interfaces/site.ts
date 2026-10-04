import type { Locale } from './locale'

export const SITE_MODULES = ['newsletter', 'comments', 'accounts', 'drafts', 'fediverse', 'search', 'support'] as const
export type SiteModule = typeof SITE_MODULES[number]
export type SiteModules = Record<SiteModule, boolean>

export const SOCIAL_NETWORKS = ['github', 'gitlab', 'codeberg', 'linkedin', 'mastodon', 'bluesky', 'x', 'website'] as const
export type SocialNetwork = typeof SOCIAL_NETWORKS[number]

export interface SocialLink {
  network: SocialNetwork
  url: string
}

export interface SiteImage {
  url: string
  alternativeText?: string
  width?: number
  height?: number
}

export interface SiteAuthor {
  name: string
  url: string
}

/** The site identity every page reads through useSite() (docs/api.md, GET /api/site). */
export interface Site {
  name: string
  description: string
  url: string
  defaultLocale: Locale
  author: SiteAuthor
  logo: SiteImage | null
  favicon: SiteImage | null
  defaultOgImage: SiteImage | null
  socialLinks: SocialLink[]
  contactEmail: string
  privacyContactEmail: string
  privacyUpdatedAt: string
  supportHandle: string
  modules: SiteModules
}

/** The fields of Strapi's site-setting that passed validation; a missing one falls back. */
export type SiteSettings = Partial<Omit<Site, 'author' | 'modules'>> & {
  author?: Partial<SiteAuthor>
  modules?: Partial<SiteModules>
}
