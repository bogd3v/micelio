import type { PostCardProps, PostListItem } from '~/interfaces'
import { formatDotDate } from '~/helpers/formatDate'

/** The props of a post card; `category` is any slug of the CMS (ADR 0016). */
export type PostCardData = Omit<PostCardProps, 'category'> & { category?: string, categoryName?: string }

/**
 * Returns a function that maps a list item to the props of a post card.
 *
 * @remarks
 * The link goes to the blog path of the current locale. The category is the slug the post has, and the read mark comes from `useReadArticles`. Optional fields that the post lacks become `undefined`, not `null`. Call it in setup, because it reads `useI18n`, `useStrapi`, `useLocaleUtils` and `useReadArticles`.
 */
export function usePostCard(): (post: PostListItem) => PostCardData {
  const { t } = useI18n()
  const { getMediaUrl } = useStrapi()
  const { localizePath } = useLocaleUtils()
  const { isRead } = useReadArticles()
  const site = useSite()

  return function toPostCard(post: PostListItem): PostCardData {
    return {
      title: post.title ?? '',
      slug: post.slug,
      href: `${localizePath('/blog')}/${post.slug}`,
      excerpt: post.description ?? undefined,
      snippet: post.snippet ?? undefined,
      category: post.category?.slug ?? undefined,
      categoryName: post.category?.name ?? undefined,
      date: formatDotDate(post.publishedAt, site.value.timezone) || undefined,
      dateTime: post.publishedAt ?? undefined,
      author: post.author?.name ?? undefined,
      readTime: post.readTime ? t('post.minRead', { minutes: post.readTime }) : undefined,
      image: post.cover?.url ? getMediaUrl(post.cover.url) : undefined,
      imageAlt: post.cover?.alternativeText ?? undefined,
      read: isRead(post.documentId),
    }
  }
}
