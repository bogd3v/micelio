import type { ComputedRef } from 'vue'
import { images } from '#micelio/theme'
import { absoluteUrl } from '~/helpers/site'

/** The share image of a page without a cover: the active theme's `images.ogImage` as an absolute URL, or undefined. */
export function useDefaultOgImage(): ComputedRef<string | undefined> {
  const { siteUrl } = useSiteUrl()
  return computed<string | undefined>(() => images.ogImage ? absoluteUrl(images.ogImage, siteUrl.value) : undefined)
}
