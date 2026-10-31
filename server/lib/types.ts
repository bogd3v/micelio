import type { SiteSettings } from '../../app/interfaces/site'
import type { LoadedEntry, RuntimeData } from '../../modules/theme/install/types'
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
  /** The `username` of the CMS's `fediverse` component, the `@user` of the site actor's handle. */
  fediverseUsername?: string
}

declare module 'h3' {
  interface H3EventContext {
    /** The theme this request renders, the one active when it arrived: a switch during the render does not change it. */
    activeTheme?: BuiltInTheme
    /** The active theme's data for the page, set on every request by `server/plugins/builtInTheme.ts`. */
    theme?: ThemeData
    /** The active theme's messages by locale, frozen and shared by every request; a page takes the one of its locale. */
    themeMessages?: Record<string, ThemeMessages>
  }
}

/** The theme the server renders: its verified entry and the data parsed from it. */
export interface BuiltInTheme {
  entry: LoadedEntry
  runtime: RuntimeData
  /** The package digest the image's lock pins for this theme, when it came from the registry: what a site's `themeDigest` names. */
  pinned?: string
}

/** Who a preview grant acts for, as the CMS says in `meta.actor` of the draft (ADR 0019, section 3 and the amendment of 2026-10-25). */
export type PreviewActor = 'admin' | 'system'

/** The draft a request to the weight route redeemed, which its in-process sub-requests read instead of asking the CMS. */
export interface PreviewDraftContext {
  kind: 'article' | 'page'
  documentId: string
  /** The draft as the CMS sanitized it, still to be shaped by the draft route. */
  draft: unknown
}
