import type { ComputedRef } from 'vue'
import type { Site } from '~/interfaces'
import { siteFromAppConfig } from '~/helpers/site'
import type { AppSiteConfig } from '~/helpers/site'

/** The site identity from GET /api/site, with app.config.ts's values until it answers or if it fails. */
export function useSite(): ComputedRef<Site> {
  const { locale } = useI18n()
  const appConfig = useAppConfig()
  const defaults = siteFromAppConfig(appConfig.site as AppSiteConfig)

  const { data } = useAsyncData(
    () => `site-${locale.value}`,
    () => $fetch<Site>('/api/site', { query: { locale: locale.value } }),
    { default: () => defaults, dedupe: 'defer' },
  )

  return computed<Site>(() => data.value ?? defaults)
}
