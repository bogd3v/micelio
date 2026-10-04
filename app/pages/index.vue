<script setup lang="ts">
import type { Category, FieldGuideTopic, Locale, PostListItem } from '~/interfaces'
import { CATEGORIES, isCategory } from '~/helpers/categories'
import { siteLogoUrl } from '~/helpers/site'

const { locale, t } = useI18n()
const { fetchPosts, fetchCategories } = useStrapi()
const { siteUrl } = useSiteUrl()
const site = useSite()
const { canonicalUrl } = useCanonicalUrl('/')
const toPostCard = usePostCard()
const fediverseOn = useModule('fediverse')
const newsletterOn = useModule('newsletter')

const { data: postsResult } = fetchPosts({ pageSize: 1, locale: locale.value as Locale })
const { data: categories } = fetchCategories(locale.value as Locale)

const featuredPost = computed<PostListItem | undefined>(() => postsResult.value?.data[0])
const total = computed<number>(() => postsResult.value?.pagination.total ?? 0)
const counts = computed<Partial<Record<Category, number>>>(() =>
  Object.fromEntries(
    (categories.value ?? [])
      .filter(category => isCategory(category.slug))
      .map(category => [category.slug, category.count]),
  ),
)
const topics = computed<FieldGuideTopic[]>(() =>
  CATEGORIES.map(category => ({ category, count: counts.value[category] ?? 0 })),
)

useSeoMeta({
  title: () => `${site.value.name} - Personal Blog`,
  ogTitle: () => `${site.value.name} - Personal Blog`,
  description: 'Explore articles on AI, software development, Linux, and modern tech. Join me on my journey through technology.',
  ogDescription: 'Explore articles on AI, software development, Linux, and modern tech. Join me on my journey through technology.',
  ogImage: () => `${siteUrl.value}/og-image.png`,
  ogImageAlt: () => `${site.value.name} — Exploring AI, Software and Linux`,
  ogUrl: () => canonicalUrl.value,
  twitterCard: 'summary_large_image',
  twitterImage: () => `${siteUrl.value}/og-image.png`,
  twitterTitle: () => `${site.value.name} - Personal Blog`,
  twitterDescription: 'Explore articles on AI, software development, Linux, and modern tech.',
})

const structuredData = computed(() => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl.value}/#website`,
      'url': siteUrl.value,
      'name': site.value.name,
      'description': site.value.description,
      'publisher': {
        '@id': `${siteUrl.value}/#organization`,
      },
      'potentialAction': {
        '@type': 'SearchAction',
        'target': {
          '@type': 'EntryPoint',
          'urlTemplate': `${siteUrl.value}/blog?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
      'inLanguage': locale.value === 'es' ? 'es-CO' : 'en-US',
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl.value}/#organization`,
      'name': site.value.name,
      'url': siteUrl.value,
      'logo': {
        '@type': 'ImageObject',
        'url': siteLogoUrl(site.value, siteUrl.value),
      },
      'sameAs': site.value.socialLinks.map(link => link.url),
    },
  ],
}))

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(structuredData.value),
    },
  ],
})
</script>

<template>
  <div class="bd-home">
    <HomeHero :total="total" />

    <section v-if="featuredPost" class="bd-home-featured bd-reveal" :aria-label="t('bd.card.featured')">
      <BdPostCard v-bind="toPostCard(featuredPost)" featured priority />
    </section>

    <HomeLatest :total="total" :counts="counts" />

    <HomeFieldGuide :topics="topics" />

    <HomeFediverse v-if="fediverseOn" />

    <HomeSubscribe v-if="newsletterOn" />
  </div>
</template>
