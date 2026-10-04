import type { ComputedRef } from 'vue'

/**
 * Shared site URL: `public.siteUrl` (NUXT_PUBLIC_SITE_URL), falling back to the site's own URL
 * from useSite(). Use it instead of inlining `config.public.siteUrl`.
 */
export function useSiteUrl(): { siteUrl: ComputedRef<string> } {
  const config = useRuntimeConfig()
  const site = useSite()

  const siteUrl = computed<string>(() => (config.public.siteUrl || site.value.url).replace(/\/+$/, ''))

  return { siteUrl }
}
