import type { Ref } from 'vue'
import type { Locale, LocalePaths, Page, Site } from '~/interfaces'
import { homePaths, pagePaths } from '~/helpers/translations'
import { pageTitle } from '~/helpers/site'

interface SectionPageState {
  page: Ref<Page | undefined>
  /** Status of the failed request (404 and 400 mean no such page); undefined when it loaded */
  failure: Ref<number | undefined>
}

/** Fetches /api/pages/<slug> for the current locale. */
export async function useSectionPage(slug: string): Promise<SectionPageState> {
  const { locale } = useI18n()
  const { data, error } = await useAsyncData<Page>(`page-${slug}-${locale.value}`, () =>
    $fetch<Page>(`/api/pages/${encodeURIComponent(slug)}`, { query: { locale: locale.value } }),
  )
  const failure = computed<number | undefined>(() => error.value ? (error.value.statusCode ?? 500) : data.value ? undefined : 500)
  return { page: data as Ref<Page | undefined>, failure }
}

/** Title, description, share image and robots from the page's `seo`; `canonicalPath` is the URL the page answers to as canonical. */
export function usePageSeo(page: Ref<Page | undefined>, canonicalPath: string): void {
  const { getMediaUrl } = useStrapi()
  const { canonicalUrl } = useCanonicalUrl(canonicalPath)
  const defaultOgImage = useDefaultOgImage()
  const site = useSite()

  const shareImageUrl = computed<string | undefined>(() => getMediaUrl(page.value?.seo?.metaImage?.url) || defaultOgImage.value)
  const seoTitle = computed<string>(() => page.value?.seo?.metaTitle || pageTitle(page.value?.title || '', site.value.name))
  const seoDescription = computed<string>(() => page.value?.seo?.metaDescription || '')
  const pageUrl = computed<string>(() => page.value?.seo?.canonicalURL || canonicalUrl.value)

  useSeoMeta({
    title: () => seoTitle.value,
    ogTitle: () => seoTitle.value,
    description: () => seoDescription.value,
    ogDescription: () => seoDescription.value,
    ogImage: () => shareImageUrl.value,
    ogImageAlt: () => page.value?.seo?.metaImage?.alternativeText || page.value?.title || '',
    ogUrl: () => pageUrl.value,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: () => seoTitle.value,
    twitterDescription: () => seoDescription.value,
    twitterImage: () => shareImageUrl.value,
    robots: () => page.value?.seo?.metaRobots || undefined,
  })

  useHead({
    link: () => [{ rel: 'canonical' as const, href: pageUrl.value }],
  })
}

/**
 * hreflang for a section page: each translation points at its canonical path, which is its language's root when it is that language's home page.
 * Runs on the server only and hydrates from the payload.
 */
export async function useAlternates(page: Page, isHome: boolean): Promise<LocalePaths> {
  const { locale } = useI18n()
  const current = locale.value as Locale
  const { data } = await useAsyncData<LocalePaths>(`home-alternates-${page.slug}-${locale.value}`, async () => {
    const homeSlugs: Partial<Record<Locale, string | undefined>> = {}
    await Promise.all(page.translations.filter(item => item.locale !== current).map(async (item) => {
      let other: Site | undefined
      try {
        other = await $fetch<Site>('/api/site', { query: { locale: item.locale } })
      } catch {
        other = undefined
      }
      homeSlugs[item.locale] = other?.homePage?.slug
    }))
    return isHome ? homePaths(current, page.translations, homeSlugs) : pagePaths(page.slug, current, page.translations, homeSlugs)
  })
  return data.value ?? {}
}
