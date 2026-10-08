import qs from 'qs'
import { buildSiteMode } from '#micelio/build-site-mode'
import { buildTheme } from '#micelio/build-theme'
import { modes as paletteModes, rules as paletteRules } from '#micelio/theme-palette'
import { images } from '#micelio/theme'
import type { Locale, Site } from '~/interfaces'
import { effectiveModules } from '~/helpers/modules'
import { moduleRequirements } from '~/helpers/runtimeConfig'
import { mergeSite, resolveSiteMedia, siteFromAppConfig } from '~/helpers/site'
import type { AppSiteConfig } from '~/helpers/site'
import { parseSiteSettings } from '../schemas/site'

// Strapi is optional for the identity, so a slow answer should not hold the page
const SITE_TIMEOUT_MS = 3000
// Module checks run on every request; a short cache keeps them off Strapi (docs/api.md)
const FAILED_CACHE_MS = 10_000

// Strapi does not mix '*' with keyed entries; one per relation or component parseSiteSettings reads.
// `accentOverrides` sits inside `theme`, one level down, so it needs its own populate.
const SITE_POPULATE = {
  author: true,
  logo: true,
  favicon: true,
  defaultOgImage: true,
  socialLinks: true,
  modules: true,
  theme: { populate: '*' },
  homePage: { fields: ['slug'] },
}

export interface LoadedSite {
  site: Site
  /** false when Strapi failed and every value comes from app.config.ts */
  fromStrapi: boolean
}

/** The site identity: Strapi's site-setting over app.config.ts, field by field, with the modules that actually work. */
export async function loadSite(locale: Locale): Promise<LoadedSite> {
  const defaults = siteFromAppConfig(useAppConfig().site as AppSiteConfig, images.favicon)
  const requirements = moduleRequirements(useRuntimeConfig())
  let loaded: LoadedSite
  try {
    // Nested populate does not survive fetch's query option, so the string is built here
    const query = qs.stringify({ populate: SITE_POPULATE, locale })
    const response = await strapiFetch<{ data?: unknown }>(`/api/site-setting?${query}`, { timeout: SITE_TIMEOUT_MS })
    const settings = resolveSiteMedia(parseSiteSettings(response.data), useRuntimeConfig().public.strapiUrl)
    const theme = resolveTheme(settings?.theme, { modes: paletteModes, rules: paletteRules }, buildTheme)
    loaded = { site: { ...mergeSite(defaults, settings), ...(theme && { theme }) }, fromStrapi: true }
  } catch (error: unknown) {
    console.error('Strapi fetch site-setting error:', asUpstreamError(error).data || error)
    loaded = { site: defaults, fromStrapi: false }
  }
  return { ...loaded, site: { ...loaded.site, modules: effectiveModules(loaded.site.modules, requirements, buildSiteMode) } }
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
  void shortenWhenFailed(locale, value, cacheMs)
  return value
}

async function shortenWhenFailed(locale: Locale, value: Promise<LoadedSite>, cacheMs: number): Promise<void> {
  try {
    const loaded = await value
    if (!loaded.fromStrapi) cache.set(locale, { expires: Date.now() + Math.min(cacheMs, FAILED_CACHE_MS), value })
  } catch {
    // The caller of loadSiteCached sees the error
  }
}
