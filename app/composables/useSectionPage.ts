import type { Ref } from 'vue'
import type { Locale, LocalePaths, Page, Site } from '~/interfaces'
import { homePaths } from '~/helpers/translations'
import { pageTitle } from '~/helpers/site'

export interface SectionPageState {
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

/** hreflang for a page shown at `/`: asks each translation's locale which page is its home page. */
export async function useHomeAlternates(page: Page): Promise<LocalePaths> {
  const { locale } = useI18n()
  const homeSlugs: Partial<Record<Locale, string | undefined>> = {}
  await Promise.all(page.translations.filter(item => item.locale !== locale.value).map(async (item) => {
    const other = await $fetch<Site>('/api/site', { query: { locale: item.locale } }).catch(() => undefined)
    homeSlugs[item.locale] = other?.homePage?.slug
  }))
  return homePaths(locale.value as Locale, page.translations, homeSlugs)
}
