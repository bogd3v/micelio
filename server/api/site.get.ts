import type { Site } from '~/interfaces'
import { mergeSite, siteFromAppConfig } from '~/helpers/site'
import type { AppSiteConfig } from '~/helpers/site'
import { listLocaleQuerySchema } from '../schemas/query'
import { parseSiteSettings } from '../schemas/site'

// Strapi is optional for the identity, so a slow answer should not hold the page
const SITE_TIMEOUT_MS = 3000

export default defineEventHandler(async (event): Promise<Site> => {
  const { locale } = validQuery(event, listLocaleQuerySchema)
  const defaults = siteFromAppConfig(useAppConfig().site as AppSiteConfig)

  try {
    const response = await strapiFetch<{ data?: unknown }>('/api/site-setting', { query: { populate: '*', locale }, timeout: SITE_TIMEOUT_MS })
    setHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return mergeSite(defaults, parseSiteSettings(response.data))
  } catch (error: unknown) {
    // The site must render without Strapi: answer with app.config's values, cached briefly
    console.error('Strapi fetch site-setting error:', asUpstreamError(error).data || error)
    setHeader(event, 'Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    return defaults
  }
})
