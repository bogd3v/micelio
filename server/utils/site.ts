import type { Locale, Site } from '~/interfaces'
import { mergeSite, siteFromAppConfig } from '~/helpers/site'
import type { AppSiteConfig } from '~/helpers/site'
import { parseSiteSettings } from '../schemas/site'

// Strapi is optional for the identity, so a slow answer should not hold the page
const SITE_TIMEOUT_MS = 3000

export interface LoadedSite {
  site: Site
  /** false when Strapi failed and every value comes from app.config.ts */
  fromStrapi: boolean
}

/** The site identity: Strapi's site-setting over app.config.ts, field by field (docs/api.md). */
export async function loadSite(locale: Locale): Promise<LoadedSite> {
  const defaults = siteFromAppConfig(useAppConfig().site as AppSiteConfig)
  try {
    const response = await strapiFetch<{ data?: unknown }>('/api/site-setting', { query: { populate: '*', locale }, timeout: SITE_TIMEOUT_MS })
    return { site: mergeSite(defaults, parseSiteSettings(response.data)), fromStrapi: true }
  } catch (error: unknown) {
    console.error('Strapi fetch site-setting error:', asUpstreamError(error).data || error)
    return { site: defaults, fromStrapi: false }
  }
}
