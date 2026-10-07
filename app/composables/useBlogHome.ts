import type { ComputedRef } from 'vue'
import type { Category, FieldGuideTopic, Locale, PostListItem } from '~/interfaces'
import { CATEGORIES, isCategory } from '~/helpers/categories'
import { siteLogoUrl } from '~/helpers/site'

export interface BlogHome {
  featuredPost: ComputedRef<PostListItem | undefined>
  total: ComputedRef<number>
  counts: ComputedRef<Partial<Record<Category, number>>>
  topics: ComputedRef<FieldGuideTopic[]>
}

/** The data and the head of the blog home page (`/`), used when no page is set as the home page. */
export function useBlogHome(): BlogHome {
  const { locale } = useI18n()
  const { fetchPosts, fetchCategories } = useStrapi()
  const { siteUrl } = useSiteUrl()
  const defaultOgImage = useDefaultOgImage()
  const site = useSite()
  const { canonicalUrl } = useCanonicalUrl('/')

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
    ogImage: () => defaultOgImage.value,
    ogImageAlt: () => `${site.value.name} — Exploring AI, Software and Linux`,
    ogUrl: () => canonicalUrl.value,
    twitterCard: 'summary_large_image',
    twitterImage: () => defaultOgImage.value,
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

  return { featuredPost, total, counts, topics }
}
