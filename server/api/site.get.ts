import type { Site } from '~/interfaces'
import { listLocaleQuerySchema } from '../schemas/query'

export default defineEventHandler(async (event): Promise<Site> => {
  const { locale } = validQuery(event, listLocaleQuerySchema)
  const { site, fromStrapi } = await loadSite(locale)
  // The site must render without Strapi: app.config's values, cached briefly
  setHeader(event, 'Cache-Control', fromStrapi
    ? 'public, s-maxage=300, stale-while-revalidate=600'
    : 'public, s-maxage=30, stale-while-revalidate=60')
  return site
})
