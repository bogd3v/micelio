<script setup lang="ts">
import type { Locale } from '~/interfaces'
import { articlePaths } from '~/helpers/translations'
import { pageTitle, siteLogoUrl } from '~/helpers/site'

const { locale, t } = useI18n()
const route = useRoute()
const slug = route.params.slug as string
const { fetchPost, getMediaUrl } = useStrapi()
const categoryLabel = useCategoryLabel()
const { siteUrl } = useSiteUrl()
const site = useSite()
const { canonicalUrl } = useCanonicalUrl(`/blog/${slug}`)
const headerSection = useHeaderSection()
const { setAlternates } = useLocaleAlternates()

const { data: post, error } = await fetchPost(slug, locale.value as Locale)

if (error.value || !post.value) {
  const statusCode = error.value?.statusCode ?? 404
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? 'Post not found' : 'Failed to load post',
    fatal: true,
  })
}

watch(post, (value) => {
  setAlternates(value ? articlePaths(slug, locale.value as Locale, value.translations) : {})
}, { immediate: true })

watch(() => categoryLabel(post.value?.category), (label) => {
  headerSection.value = label
}, { immediate: true })

onBeforeUnmount(() => {
  headerSection.value = ''
})

const coverUrl = computed(() => {
  if (!post.value?.cover) return ''
  return getMediaUrl(post.value.cover)
})

const seoImageUrl = computed(() => {
  const metaImage = post.value?.seo?.metaImage
  return getMediaUrl(metaImage?.url || metaImage?.data?.attributes?.url)
})

const shareImageUrl = computed(() => seoImageUrl.value || coverUrl.value || `${siteUrl.value}/og-image.png`)

const shareImageAlt = computed(() => post.value?.cover?.alternativeText || post.value?.title || 'Blog post cover image')

const articleUrl = computed<string>(() => post.value?.seo?.canonicalURL || canonicalUrl.value)

useSeoMeta({
  title: () => post.value?.seo?.metaTitle || pageTitle(post.value?.title || 'Post', site.value.name),
  ogTitle: () => post.value?.seo?.metaTitle || post.value?.title || 'Blog Post',
  description: () => post.value?.seo?.metaDescription || post.value?.description || '',
  ogDescription: () => post.value?.seo?.metaDescription || post.value?.description || '',
  ogImage: () => shareImageUrl.value,
  ogImageAlt: () => shareImageAlt.value,
  ogUrl: () => post.value?.seo?.canonicalURL || canonicalUrl.value,
  ogType: 'article',
  articlePublishedTime: () => post.value?.publishedAt,
  articleAuthor: () => post.value?.author?.name ? [post.value.author.name] : undefined,
  articleTag: () =>
    post.value?.seo?.keywords
      ?.split(',')
      .map((k: string) => k.trim())
      .filter(Boolean)
      || post.value?.tags?.map(tag => tag.name)
      || [],
  twitterCard: 'summary_large_image',
  twitterTitle: () => post.value?.seo?.metaTitle || post.value?.title || 'Blog Post',
  twitterDescription: () => post.value?.seo?.metaDescription || post.value?.description || '',
  twitterImage: () => shareImageUrl.value,
  twitterImageAlt: () => shareImageAlt.value,
})

useHead({
  meta: () => post.value?.seo?.metaRobots
    ? [{ name: 'robots', content: post.value.seo.metaRobots }]
    : [],
})

const structuredData = computed(() => {
  if (!post.value) return null

  if (post.value.seo?.structuredData) {
    return post.value.seo.structuredData
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${siteUrl.value}/blog/${slug}`,
        'headline': post.value.title,
        'description': post.value.description,
        'image': shareImageUrl.value,
        'datePublished': post.value.publishedAt,
        'dateModified': post.value.publishedAt,
        'author': {
          '@type': 'Person',
          'name': post.value.author?.name || t('post.anonymous'),
          'url': `${siteUrl.value}/about`,
        },
        'publisher': {
          '@type': 'Organization',
          'name': site.value.name,
          'url': siteUrl.value,
          'logo': {
            '@type': 'ImageObject',
            'url': siteLogoUrl(site.value, siteUrl.value),
          },
        },
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': `${siteUrl.value}/blog/${slug}`,
        },
        'articleSection': categoryLabel(post.value.category) || undefined,
        'keywords': (post.value.tags || []).map(tag => tag.name).join(', '),
        'wordCount': 0,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${siteUrl.value}/blog/${slug}#breadcrumb`,
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': siteUrl.value,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Blog',
            'item': `${siteUrl.value}/blog`,
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': post.value.title,
            'item': `${siteUrl.value}/blog/${slug}`,
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl.value}/#website`,
        'url': siteUrl.value,
        'name': site.value.name,
        'description': site.value.description,
        'publisher': {
          '@type': 'Organization',
          '@id': `${siteUrl.value}/#organization`,
        },
        'potentialAction': {
          '@type': 'SearchAction',
          'target': {
            '@type': 'EntryPoint',
            'urlTemplate':
                            `${siteUrl.value}/blog?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
})

useHead({
  script: () => structuredData.value
    ? [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(structuredData.value),
        },
      ]
    : [],
})
</script>

<template>
  <RegionArticle v-if="post" :post="post" :share-url="articleUrl" />
</template>
