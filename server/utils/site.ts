import qs from 'qs'
import { buildSiteMode } from '#micelio/build-site-mode'
import { activeTheme, observeTheme } from './activeTheme'
import type { Locale, Site, AppSiteConfig } from '~/interfaces'
import { effectiveModules } from '~/helpers/modules'
import { moduleRequirements } from '~/helpers/runtimeConfig'
import { fediverseCreator, mergeSite, resolveSiteMedia, siteFromAppConfig } from '~/helpers/site'
import { SITE_POPULATE } from '../lib/constants'
import { decidesTheme } from '../lib/themeSwitch/request'
import { parseSiteSettings } from '../schemas/site'

// Strapi is optional for the identity, so a slow answer should not hold the page
const SITE_TIMEOUT_MS = 3000
// Module checks run on every request; a short cache keeps them off Strapi (docs/api.md)
const FAILED_CACHE_MS = 10_000

interface LoadedSite {
  site: Site
  /** false when Strapi failed and every value comes from app.config.ts */
  fromStrapi: boolean
  /** The `securityContact` of the site settings, validated; never in `site` because only `security.txt` reads it. */
  securityContact?: string
  /** The digest of the theme `site.theme` was resolved against; a render of another theme leaves those overrides out. */
  themeDigest: string
}

// The site actor's handle when Strapi's `fediverse` switch is on, not the effective module: the actor lives on the CMS,
// so a static site's articles still have an author on the fediverse (docs/api.md, "Fediverse creator")
function siteFediverseHandle(site: Pick<Site, 'modules'>, username?: string): string | undefined {
  if (!site.modules.fediverse) return undefined
  return fediverseCreator(String(useRuntimeConfig().public.fediverseHandle ?? ''), username)
}

/** The site identity: Strapi's site-setting over app.config.ts, field by field, with the modules that actually work. `quiet` skips the error log (the startup check). */
export async function loadSite(locale: Locale, options: { quiet?: boolean } = {}): Promise<LoadedSite> {
  const { runtime } = activeTheme()
  const themeDigest = runtime.digest
  const defaults = siteFromAppConfig(useAppConfig().site as AppSiteConfig, runtime.images.favicon)
  const requirements = moduleRequirements(useRuntimeConfig())
  let loaded: LoadedSite
  try {
    // Nested populate does not survive fetch's query option, so the string is built here
    const query = qs.stringify({ populate: SITE_POPULATE, locale })
    const response = await strapiFetch<{ data?: unknown }>(`/api/site-setting?${query}`, { timeout: SITE_TIMEOUT_MS })
    const parsed = parseSiteSettings(response.data)
    const settings = resolveSiteMedia(parsed, useRuntimeConfig().public.strapiUrl)
    // The default language's settings decide the theme (the field is not translated). The switch happens in the background, so nothing here waits for it.
    // A static build resolves its theme itself (#315) and never switches.
    if (decidesTheme(locale, buildSiteMode)) observeTheme(settings?.theme)
    const theme = resolveTheme(settings?.theme, runtime.palette, runtime.id)
    const site = { ...mergeSite(defaults, settings), ...(theme && { theme }) }
    const fediverseHandle = siteFediverseHandle(site, parsed?.fediverseUsername)
    loaded = { site: { ...site, ...(fediverseHandle && { fediverseHandle }) }, fromStrapi: true, securityContact: parsed?.securityContact, themeDigest }
  } catch (error: unknown) {
    if (!options.quiet) logError('cms.site-setting', 'Fetching the site settings failed', { error })
    loaded = { site: defaults, fromStrapi: false, themeDigest }
  }
  return { ...loaded, site: { ...loaded.site, modules: effectiveModules(loaded.site.modules, requirements, buildSiteMode) } }
}

const cache = new Map<Locale, { expires: number, value: Promise<LoadedSite> }>()

/** Forgets the cached site settings; a theme switch calls it so no reader gets overrides resolved against the theme that was replaced. */
export function clearSiteCache(): void {
  cache.clear()
}

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
