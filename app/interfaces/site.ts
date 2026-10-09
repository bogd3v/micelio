import type { Locale } from './locale'

export const SITE_MODULES = ['newsletter', 'comments', 'accounts', 'drafts', 'fediverse', 'search', 'support'] as const
export type SiteModule = typeof SITE_MODULES[number]
export type SiteModules = Record<SiteModule, boolean>

export const SOCIAL_NETWORKS = ['github', 'gitlab', 'codeberg', 'linkedin', 'mastodon', 'bluesky', 'x', 'website'] as const
export type SocialNetwork = typeof SOCIAL_NETWORKS[number]

/** The display fonts Strapi can choose from (ADR 0005, section 8). */
export const DISPLAY_FONTS = ['archivo', 'fraunces', 'bricolage-grotesque', 'newsreader', 'space-grotesk'] as const
export type DisplayFont = typeof DISPLAY_FONTS[number]

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

/** The accent family of one mode, as `#rrggbb`, after the contrast correction. */
export interface AccentColors {
  accent: string
  accentSoft: string
  accentHover: string
  onAccent: string
}

/**
 * What Strapi's `site-setting.theme` came to after the server checked it against the built theme (ADR 0005, section 8).
 * Absent when it changes nothing. `accents` holds only modes whose accent differs from the theme's.
 */
export interface SiteTheme {
  /** The built theme: the only one a build has. */
  id: string
  /** A mode of that theme. */
  defaultMode?: string
  displayFont?: DisplayFont
  /** By mode id. */
  accents: Record<string, AccentColors>
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
  theme?: SiteTheme
  /** The page shown at `/` in this locale; absent keeps the blog home */
  homePage?: { slug: string }
}

/** What Strapi's `theme` component held, validated and not yet checked against the theme. */
export interface ThemeSettings {
  themeId?: string
  defaultMode?: string
  /** One per mode, the first one kept. */
  accentOverrides?: Array<{ mode: string, color: string }>
  displayFont?: DisplayFont
}

/** The fields of Strapi's site-setting that passed validation; a missing one falls back. */
export type SiteSettings = Partial<Omit<Site, 'author' | 'modules' | 'theme'>> & {
  author?: Partial<SiteAuthor>
  modules?: Partial<SiteModules>
  theme?: ThemeSettings
}

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

/** How a site is built (ADR 0006, section 1). `SITE_MODES` in `helpers/siteMode.ts` lists them. */
export type SiteMode = 'dynamic' | 'static' | 'landing'
