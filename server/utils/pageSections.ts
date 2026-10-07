import qs from 'qs'
import { parsePage } from '../schemas/page'
import type { Page, PageSection, PostListItem, PostListSection, StrapiPaginatedResponse } from '~/interfaces'

// Strapi does not mix '*' with keyed entries: every relation of every section is named.
// Links and media are listed explicitly so a new CMS field never widens the response.
export const PAGE_POPULATE = {
  seo: { populate: '*' },
  localizations: { fields: ['slug', 'locale'] },
  sections: {
    on: {
      'section.hero': { populate: { primaryLink: true, secondaryLink: true, media: true } },
      'section.feature-grid': { populate: { items: { populate: { icon: true } } } },
      'section.media-showcase': { populate: { media: true, link: true } },
      'section.stats': { populate: { items: true } },
      'section.logo-cloud': { populate: { logos: { populate: { image: true } } } },
      'section.testimonials': { populate: { items: { populate: { avatar: true } } } },
      'section.pricing': { populate: { plans: { populate: { link: true } } } },
      'section.faq': { populate: { items: true } },
      'section.cta': { populate: { primaryLink: true, secondaryLink: true } },
      'section.post-list': { populate: { category: { fields: ['slug'] }, tag: { fields: ['slug'] } } },
      'section.newsletter': { populate: '*' },
      'section.rich-text': { populate: '*' },
      'section.gallery': { populate: { images: true } },
      'section.scene': { populate: { model: true, poster: true } },
    },
  },
}

/** The newest published posts of a `post-list` section; none (or a Strapi failure) gives an empty list. */
async function postsOf(section: PostListSection, locale: string | undefined): Promise<PostListItem[]> {
  const filters: Record<string, unknown> = {}
  if (section.category) filters.category = { slug: { $eq: section.category } }
  if (section.tag) filters.tags = { slug: { $eq: section.tag } }
  const query = qs.stringify({
    populate: POST_CARD_POPULATE,
    locale,
    sort: 'publishedAt:desc',
    pagination: { page: 1, pageSize: section.count },
    ...(Object.keys(filters).length > 0 && { filters }),
  }, { skipNulls: true })
  try {
    const response = await strapiFetch<StrapiPaginatedResponse<PostListItem[]>>(`/api/articles?${query}`)
    return (response.data ?? []).slice(0, section.count)
  } catch (error: unknown) {
    console.error('Strapi fetch page post-list error:', asUpstreamError(error).data || error)
    return []
  }
}

/** Post lists resolved per page; the others render with no posts, so one page cannot fan out into many Strapi calls */
export const MAX_POST_LISTS = 4

/** Fills the posts of the first `MAX_POST_LISTS` `post-list` sections, in parallel. */
export function resolvePostLists(sections: PageSection[], locale: string | undefined): Promise<PageSection[]> {
  let lists = 0
  return Promise.all(sections.map(async (section) => {
    if (section.__component !== 'section.post-list') return section
    lists += 1
    return lists > MAX_POST_LISTS ? section : { ...section, posts: await postsOf(section, locale) }
  }))
}

async function fetchPage(slug: string, locale: string | undefined): Promise<Page | undefined> {
  const query = qs.stringify({
    filters: { slug: { $eq: slug } },
    locale,
    pagination: { limit: 1 },
    populate: PAGE_POPULATE,
  }, { skipNulls: true })

  let response: { data?: unknown[] }
  try {
    response = await strapiFetch<{ data?: unknown[] }>(`/api/pages?${query}`)
  } catch (error: unknown) {
    console.error('Strapi fetch page error:', asUpstreamError(error).data || error)
    throw createError({
      statusCode: 502,
      message: upstreamErrorMessage(error, 'Failed to fetch page'),
    })
  }

  const config = useRuntimeConfig()
  const page = parsePage(response.data?.[0], {
    render: markdownRenderer(locale).renderMarkdown,
    siteUrl: config.public.siteUrl,
    mediaOrigins: [config.public.strapiUrl, config.mediaUrl],
  })
  // undefined is not stored by the cache, so a page published later shows up at once
  return page ? { ...page, sections: await resolvePostLists(page.sections, locale) } : undefined
}

/**
 * A page for 5 minutes, per locale and slug (stale while revalidating). Not found is `undefined` and
 * errors are thrown; neither is stored. The route's `Cache-Control` is only defensive (ADR 0001).
 */
export const loadPage = defineCachedFunction(fetchPage, {
  name: 'page',
  getKey: (slug: string, locale: string | undefined) => `${locale ?? 'default'}:${slug}`,
  maxAge: 300,
  swr: true,
})
