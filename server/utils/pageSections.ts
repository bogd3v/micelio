import qs from 'qs'
import type { PageSection, PostListItem, PostListSection, StrapiPaginatedResponse } from '~/interfaces'

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

/** Fills the posts of every `post-list` section, in parallel. */
export function resolvePostLists(sections: PageSection[], locale: string | undefined): Promise<PageSection[]> {
  return Promise.all(sections.map(async section =>
    section.__component === 'section.post-list' ? { ...section, posts: await postsOf(section, locale) } : section,
  ))
}
