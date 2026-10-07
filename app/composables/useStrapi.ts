import { toValue, type MaybeRef } from 'vue'
import type {
  StrapiAbout,
  RawStrapiArticle,
  PostListItem,
  StrapiPost,
  SearchPostResult, StrapiPaginatedResponse, PaginationMeta,
  Locale, CategoryCount, BlogSort, TagCount } from '~/interfaces'
import { defaultLocale } from '~/interfaces'
import { toStrapiPost } from '~/helpers/post'
import { toQueryString } from '~/helpers/query'

/**
 * Strapi data access for client pages. Every helper below goes through
 * this app's Nitro server routes (/api/*) — the Strapi URL and API token
 * are never used from the browser. These are plain functions (not
 * composables), returned from the useStrapi() factory.
 */
export function useStrapi() {
  const config = useRuntimeConfig()
  // On the server this is the visitor's event.$fetch, which carries the address for the CMS rate limits
  const requestFetch = useRequestFetch()

  function fetchPosts(params?: {
    page?: MaybeRef<number | undefined>
    pageSize?: MaybeRef<number | undefined>
    locale?: MaybeRef<Locale | undefined>
    category?: MaybeRef<string | undefined>
    tag?: MaybeRef<string | undefined>
    search?: MaybeRef<string | undefined>
    sort?: MaybeRef<BlogSort | undefined>
    content?: MaybeRef<boolean | undefined>
  }) {
    const buildQuery = () => {
      return toQueryString({
        page: toValue(params?.page),
        pageSize: toValue(params?.pageSize),
        locale: toValue(params?.locale),
        category: toValue(params?.category) || undefined,
        tag: toValue(params?.tag) || undefined,
        search: toValue(params?.search) || undefined,
        sort: toValue(params?.sort) || undefined,
        content: toValue(params?.content) ? '1' : undefined,
      })
    }

    return useAsyncData(() => `posts-${buildQuery() || 'default'}`, async () => {
      const response = await requestFetch<StrapiPaginatedResponse<RawStrapiArticle[]>>(
        `/api/posts?${buildQuery()}`,
      )

      const data: PostListItem[] = response.data.map(post => ({
        id: post.id,
        documentId: post.documentId,
        title: post.title,
        slug: post.slug,
        description: post.description,
        publishedAt: post.publishedAt,
        readTime: post.readTime,
        tags: post.tags,
        cover: post.cover,
        category: post.category,
        author: post.author,
        seo: post.seo ?? undefined,
        snippet: post.snippet ?? undefined,
      }))

      return {
        data,
        pagination: response.meta.pagination,
      }
    }, {
      transform: result => result,
      default: (): { data: PostListItem[], pagination: PaginationMeta } => ({
        data: [],
        pagination: { total: 0, page: 1, pageSize: 6, pageCount: 1 },
      }),
    })
  }

  function fetchPost(slug: string, locale?: Locale) {
    return useAsyncData<StrapiPost | null>(`post-${slug}-${locale}`, async () => {
      const query = toQueryString({
        locale: locale || undefined,
      })

      const response = await requestFetch<RawStrapiArticle | null>(
        `/api/posts/${slug}?${query}`,
      )

      return response ? toStrapiPost(response) : null
    })
  }

  async function searchPosts(queryStr: string, locale?: Locale, content = false): Promise<SearchPostResult[]> {
    return requestFetch<SearchPostResult[]>('/api/search', {
      query: { q: queryStr, locale, content: content ? '1' : undefined },
    })
  }

  function fetchCategories(locale?: Locale) {
    return useAsyncData(`categories-${locale || defaultLocale}`, async () => {
      const query = toQueryString({
        locale: locale || undefined,
      })

      return requestFetch<CategoryCount[]>(
        `/api/categories?${query}`,
      )
    }, {
      default: () => [],
    })
  }

  function fetchTags(locale?: Locale) {
    return useAsyncData(`tags-${locale || defaultLocale}`, async () => {
      const query = toQueryString({
        locale: locale || undefined,
      })

      return requestFetch<TagCount[]>(
        `/api/tags?${query}`,
      )
    }, {
      default: () => [],
    })
  }

  function fetchAbout(locale?: Locale) {
    return useAsyncData<StrapiAbout>(
      `about-${locale || defaultLocale}`,
      async () => {
        const query = toQueryString({
          locale: locale || undefined,
        })

        return requestFetch<StrapiAbout>(`/api/about?${query}`)
      },
    )
  }

  function getMediaUrl(
    url: string | { url: string } | undefined | null,
  ): string {
    if (!url) return ''
    const urlStr = typeof url === 'object' ? url.url : url
    if (urlStr.startsWith('http')) return urlStr
    return `${config.public.strapiUrl}${urlStr}`
  }

  return {
    fetchPosts,
    fetchPost,
    fetchCategories,
    fetchTags,
    fetchAbout,
    searchPosts,
    getMediaUrl,
  }
}
