import type { SiteSettings } from '../../app/interfaces/site'
import type { ThemeData, ThemeMessages } from '../../app/interfaces/theme'

/** What a call to Strapi needs: the pure part of `strapiFetch`, usable outside Nitro (build modules). */
export interface StrapiRequestConfig {
  strapiUrl: string
  strapiApiToken?: string
}

/** A category as `loadCategories` serves it: the CMS values of one locale, with the published articles in it. */
export interface LoadedCategory {
  id: number
  slug: string
  name: string
  description: string | null
  /** The editor's position (non-localized in the CMS); null when none was set. */
  order: number | null
  /** Whether the home page highlights it: the CMS `featured`. */
  featured: boolean
  /** The color role number (1 to 5) the editor pinned in the CMS (non-localized); null when none or not valid. */
  color: number | null
  /** Published articles of the requested locale. */
  count: number
}

/** The site settings of the CMS plus what only the server reads and the theme contract does not carry. */
export interface ParsedSiteSettings extends SiteSettings {
  /** The public security contact, a `mailto:` or `https:` URI that `validSecurityContact` accepted. */
  securityContact?: string
}

declare module 'h3' {
  interface H3EventContext {
    /** The active theme's data for the page, set on every request by `server/plugins/builtInTheme.ts`. */
    theme?: ThemeData
    /** The active theme's messages by locale, frozen and shared by every request; a page takes the one of its locale. */
    themeMessages?: Record<string, ThemeMessages>
  }
}
