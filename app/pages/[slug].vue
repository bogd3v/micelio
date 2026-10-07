<script setup lang="ts">
import type { Locale, Page } from '~/interfaces'
import { pagePaths } from '~/helpers/translations'
import { pageTitle } from '~/helpers/site'

const { locale } = useI18n()
const route = useRoute()
const slug = route.params.slug as string
const { getMediaUrl } = useStrapi()
const { canonicalUrl } = useCanonicalUrl(`/${slug}`)
const defaultOgImage = useDefaultOgImage()
const site = useSite()
const { setAlternates } = useLocaleAlternates()

const { data: page, error } = await useAsyncData<Page>(`page-${slug}-${locale.value}`, () =>
  $fetch<Page>(`/api/pages/${encodeURIComponent(slug)}`, { query: { locale: locale.value } }),
)

// A slug the API rejects (400, e.g. "About") is a page that does not exist
if (error.value || !page.value) {
  const status = error.value?.statusCode
  const notFound = !status || status === 404 || status === 400
  throw createError({
    statusCode: notFound ? 404 : status,
    statusMessage: notFound ? 'Page not found' : 'Failed to load page',
    fatal: true,
  })
}

watch(page, (value) => {
  setAlternates(value ? pagePaths(slug, locale.value as Locale, value.translations) : {})
}, { immediate: true })

// A hero that opens the page carries the h1; otherwise the page title does
const heroLeads = computed<boolean>(() => page.value?.sections[0]?.__component === 'section.hero')

const shareImageUrl = computed<string | undefined>(() => getMediaUrl(page.value?.seo?.metaImage?.url) || defaultOgImage.value)
const seoTitle = computed<string>(() => page.value?.seo?.metaTitle || pageTitle(page.value?.title || '', site.value.name))
const seoDescription = computed<string>(() => page.value?.seo?.metaDescription || '')

useSeoMeta({
  title: () => seoTitle.value,
  ogTitle: () => seoTitle.value,
  description: () => seoDescription.value,
  ogDescription: () => seoDescription.value,
  ogImage: () => shareImageUrl.value,
  ogImageAlt: () => page.value?.seo?.metaImage?.alternativeText || page.value?.title || '',
  ogUrl: () => page.value?.seo?.canonicalURL || canonicalUrl.value,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
  twitterImage: () => shareImageUrl.value,
  robots: () => page.value?.seo?.metaRobots || undefined,
})

useHead({
  link: () => [{ rel: 'canonical' as const, href: page.value?.seo?.canonicalURL || canonicalUrl.value }],
})
</script>

<template>
  <div>
    <section v-if="!heroLeads" class="bd-section" data-section="title">
      <div class="bd-section-inner">
        <h1 class="bd-section-title">{{ page?.title }}</h1>
      </div>
    </section>
    <SectionRenderer :sections="page?.sections" :lead-heading="heroLeads" />
  </div>
</template>
