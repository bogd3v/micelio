import type { Locale } from './locale'

/**
 * The optional modules a site can switch on or off, in the order of the CMS `modules` component.
 *
 * @public
 */
export const SITE_MODULES = ['newsletter', 'comments', 'accounts', 'drafts', 'fediverse', 'search', 'support'] as const

/**
 * One of the optional modules listed in `SITE_MODULES`.
 *
 * @public
 */
export type SiteModule = typeof SITE_MODULES[number]

/**
 * Whether each optional module is on for the site.
 *
 * @public
 */
export type SiteModules = Record<SiteModule, boolean>

/**
 * The networks a social link can point to, as the CMS enumerates them.
 *
 * @public
 */
export const SOCIAL_NETWORKS = ['github', 'gitlab', 'codeberg', 'linkedin', 'mastodon', 'bluesky', 'x', 'website'] as const

/**
 * One of the networks listed in `SOCIAL_NETWORKS`.
 *
 * @public
 */
export type SocialNetwork = typeof SOCIAL_NETWORKS[number]

/**
 * The display fonts Strapi can choose from (ADR 0005, section 8).
 *
 * @public
 */
export const DISPLAY_FONTS = ['archivo', 'fraunces', 'bricolage-grotesque', 'newsreader', 'space-grotesk'] as const

/**
 * One of the display fonts listed in `DISPLAY_FONTS`.
 *
 * @public
 */
export type DisplayFont = typeof DISPLAY_FONTS[number]

/**
 * A link to one social network or profile of the site.
 *
 * @public
 */
export interface SocialLink {
  network: SocialNetwork
  url: string
}

/**
 * An image of the site, with its alternative text and size when Strapi gives them.
 *
 * @public
 */
export interface SiteImage {
  url: string
  /** Text for screen readers; absent when the image has none. */
  alternativeText?: string
  /** In pixels. */
  width?: number
  /** In pixels. */
  height?: number
}

/**
 * The author of the site: a name and the address of their page.
 *
 * @public
 */
export interface SiteAuthor {
  name: string
  url: string
}

/**
 * The accent family of one mode, as `#rrggbb`, after the contrast correction. Derived by `server/utils/theme.ts`.
 *
 * @public
 */
export interface AccentColors {
  accent: string
  /** The accent mixed into the surface. */
  accentSoft: string
  /** The accent mixed with the ink. */
  accentHover: string
  /** The text colour on an accent surface, the one with the better contrast. */
  onAccent: string
}

/**
 * What Strapi's `site-setting.theme` came to after the server checked it against the built theme (ADR 0005, section 8).
 * Absent when it changes nothing. `accents` holds only modes whose accent differs from the theme's.
 *
 * @public
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

/**
 * The site identity every page reads through useSite() (docs/api.md, GET /api/site).
 *
 * @public
 */
export interface Site {
  name: string
  description: string
  url: string
  defaultLocale: Locale
  author: SiteAuthor
  /** Null when the site has no logo. */
  logo: SiteImage | null
  /** Null when the site has no favicon. */
  favicon: SiteImage | null
  /** The share image of a page without a cover; null when unset, and the active theme's image is used instead. */
  defaultOgImage: SiteImage | null
  socialLinks: SocialLink[]
  /** The public contact address; falls back to the configured one when Strapi has none. */
  contactEmail: string
  /** Address for privacy requests, shown on the privacy and unsubscribe pages. */
  privacyContactEmail: string
  /** ISO 8601 date of the last change to the privacy page; empty when unset. */
  privacyUpdatedAt: string
  /** Handle of the support account; the support link is shown only when it is set. */
  supportHandle: string
  /** Which optional modules are on. */
  modules: SiteModules
  theme?: SiteTheme
  /** The page shown at `/` in this locale; absent keeps the blog home */
  homePage?: { slug: string }
}

/**
 * What Strapi's `theme` component held, validated and not yet checked against the theme.
 *
 * @public
 */
export interface ThemeSettings {
  /** The theme id Strapi asked for; the server checks it against the built theme before use. */
  themeId?: string
  /** The mode the site opens in, before the visitor picks one. */
  defaultMode?: string
  /** One per mode, the first one kept. */
  accentOverrides?: Array<{ mode: string, color: string }>
  displayFont?: DisplayFont
}

/**
 * The fields of Strapi's site-setting that passed validation; a missing one falls back.
 *
 * @public
 */
export type SiteSettings = Partial<Omit<Site, 'author' | 'modules' | 'theme'>> & {
  author?: Partial<SiteAuthor>
  modules?: Partial<SiteModules>
  theme?: ThemeSettings
}

/**
 * The `site` block of app.config.ts: the fallback when Strapi has no value.
 *
 * @public
 */
export interface AppSiteConfig {
  name: string
  description: string
  url: string
  author: { name: string, url: string }
  /** Fallback favicon, used when Strapi has none. */
  favicon?: SiteImage
  socialLinks: SocialLink[]
  support: { buyMeACoffee: string }
  privacy: { contactEmail: string, updatedAt: string }
}

/**
 * How a site is built (ADR 0006, section 1). `SITE_MODES` in `helpers/siteMode.ts` lists them.
 *
 * @public
 */
export type SiteMode = 'dynamic' | 'static' | 'landing'
