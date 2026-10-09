<script setup lang="ts">
import type { Locale } from '~/interfaces'
import { pageTitle, personStructuredData } from '~/helpers/site'

const { locale, t } = useI18n()
const { fetchAbout, getMediaUrl } = useStrapi()
const { canonicalUrl } = useCanonicalUrl('/about')
const defaultOgImage = useDefaultOgImage()
const site = useSite()

const { data: about } = await fetchAbout(locale.value as Locale)

const shareImageUrl = computed(() => {
  const metaImage = about.value?.seo?.metaImage
  return getMediaUrl(metaImage?.url || metaImage?.data?.attributes?.url) || defaultOgImage.value
})

useSeoMeta({
  title: () => about.value?.seo?.metaTitle || pageTitle('About', site.value.name),
  ogTitle: () => about.value?.seo?.metaTitle || pageTitle('About', site.value.name),
  description: () => about.value?.seo?.metaDescription || '',
  ogDescription: () => about.value?.seo?.metaDescription || '',
  ogImage: () => shareImageUrl.value,
  ogImageAlt: () => `${site.value.name} — About`,
  ogUrl: () => canonicalUrl.value,
  ogType: 'profile',
  twitterCard: 'summary',
  twitterTitle: () => about.value?.seo?.metaTitle || pageTitle('About', site.value.name),
  twitterDescription: () => about.value?.seo?.metaDescription || '',
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: () => about.value?.seo?.canonicalURL || canonicalUrl.value,
    },
  ],
})

const structuredData = computed(() => personStructuredData(site.value))

useHead({
  script: () => structuredData.value
    ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(structuredData.value) }]
    : [],
})
</script>

<template>
  <div class="bd-about">
    <StrapiBlocksRenderer v-if="about?.blocks?.length" :blocks="about.blocks" />
    <p v-else class="bd-meta bd-home-eyebrow bd-about-empty">{{ t("about.contentNotAvailable") }}</p>
  </div>
</template>
