import type { ComputedRef } from 'vue'
import { images } from '#micelio/theme'
import type { Site } from '~/interfaces'
import { fallbackModules } from '~/helpers/modules'
import { parseSiteMode } from '~/helpers/siteMode'
import { siteFromAppConfig } from '~/helpers/site'
import type { AppSiteConfig } from '~/helpers/site'

function fetchSite(): { defaults: Site, request: ReturnType<typeof useAsyncData<Site>> } {
  const { locale } = useI18n()
  const appConfig = useAppConfig()
  const { siteMode, newsletterProvider } = useRuntimeConfig().public
  const base = siteFromAppConfig(appConfig.site as AppSiteConfig, images.favicon)
  const defaults: Site = { ...base, modules: fallbackModules(base.modules, parseSiteMode(siteMode), newsletterProvider.action) }
  const request = useAsyncData(
    () => `site-${locale.value}`,
    () => $fetch<Site>('/api/site', { query: { locale: locale.value } }),
    { default: () => defaults, dedupe: 'defer' },
  )
  return { defaults, request }
}

/** The site identity from GET /api/site, with app.config.ts's values until it answers or if it fails. */
export function useSite(): ComputedRef<Site> {
  const { defaults, request } = fetchSite()
  return computed<Site>(() => request.data.value ?? defaults)
}

/** useSite() for a page that decides what to render from the site (the home page): resolves once the site has loaded. */
export async function useLoadedSite(): Promise<ComputedRef<Site>> {
  const { defaults, request } = fetchSite()
  const { data } = await request
  return computed<Site>(() => data.value ?? defaults)
}
