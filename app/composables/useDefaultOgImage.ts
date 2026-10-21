import type { ComputedRef } from 'vue'
import { defaultOgImageUrl } from '~/helpers/site'

/** The share image of a page without a cover: Strapi's `defaultOgImage`, else the active theme's `images.ogImage`. */
export function useDefaultOgImage(): ComputedRef<string | undefined> {
  const { siteUrl } = useSiteUrl()
  const { getMediaUrl } = useStrapi()
  const site = useSite()
  const { images } = useThemeData()
  return computed<string | undefined>(() => defaultOgImageUrl(site.value, images.ogImage, siteUrl.value, getMediaUrl))
}
