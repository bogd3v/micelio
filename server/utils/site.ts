import type { Locale, Site } from '~/interfaces'
import { effectiveModules } from '~/helpers/modules'
import { moduleRequirements } from '~/helpers/runtimeConfig'
import { mergeSite, siteFromAppConfig } from '~/helpers/site'
import type { AppSiteConfig } from '~/helpers/site'
import { parseSiteSettings } from '../schemas/site'

// Strapi is optional for the identity, so a slow answer should not hold the page
const SITE_TIMEOUT_MS = 3000
// Module checks run on every request; a short cache keeps them off Strapi (docs/api.md)
const FAILED_CACHE_MS = 10_000

export interface LoadedSite {
  site: Site
  /** false when Strapi failed and every value comes from app.config.ts */
  fromStrapi: boolean
}

/** The site identity: Strapi's site-setting over app.config.ts, field by field, with the modules that actually work. */
export async function loadSite(locale: Locale): Promise<LoadedSite> {
  const defaults = siteFromAppConfig(useAppConfig().site as AppSiteConfig)
  const requirements = moduleRequirements(useRuntimeConfig())
  let loaded: LoadedSite
  try {
    const response = await strapiFetch<{ data?: unknown }>('/api/site-setting', { query: { populate: '*', locale }, timeout: SITE_TIMEOUT_MS })
    loaded = { site: mergeSite(defaults, parseSiteSettings(response.data)), fromStrapi: true }
  } catch (error: unknown) {
    console.error('Strapi fetch site-setting error:', asUpstreamError(error).data || error)
    loaded = { site: defaults, fromStrapi: false }
  }
  return { ...loaded, site: { ...loaded.site, modules: effectiveModules(loaded.site.modules, requirements) } }
}

const cache = new Map<Locale, { expires: number, value: Promise<LoadedSite> }>()

/** loadSite() kept for `siteCacheSeconds` (60 by default; at most ten seconds when Strapi failed), for checks that run on every request. */
export function loadSiteCached(locale: Locale): Promise<LoadedSite> {
  const cacheMs = Number(useRuntimeConfig().siteCacheSeconds) * 1000
  if (!(cacheMs > 0)) return loadSite(locale)
  const hit = cache.get(locale)
  if (hit && hit.expires > Date.now()) return hit.value
  const value = loadSite(locale)
  cache.set(locale, { expires: Date.now() + cacheMs, value })
  void value.then((loaded) => {
    if (!loaded.fromStrapi) cache.set(locale, { expires: Date.now() + Math.min(cacheMs, FAILED_CACHE_MS), value })
  })
  return value
}
