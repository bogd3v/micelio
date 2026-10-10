import type { PostCardProps, PostListItem } from '~/interfaces'
import { isCategory } from '~/helpers/categories'
import { formatDotDate } from '~/helpers/formatDate'

/**
 * Returns a function that maps a list item to the props of a post card.
 *
 * @remarks
 * The link goes to the blog path of the current locale. The category is kept only when its slug is a known category, and the read mark comes from `useReadArticles`. Optional fields that the post lacks become `undefined`, not `null`. Call it in setup, because it reads `useI18n`, `useStrapi`, `useLocaleUtils` and `useReadArticles`.
 */
export function usePostCard(): (post: PostListItem) => PostCardProps {
  const { t } = useI18n()
  const { getMediaUrl } = useStrapi()
  const { localizePath } = useLocaleUtils()
  const { isRead } = useReadArticles()

  return function toPostCard(post: PostListItem): PostCardProps {
    const slug = post.category?.slug
    return {
      title: post.title,
      slug: post.slug,
      href: `${localizePath('/blog')}/${post.slug}`,
      excerpt: post.description ?? undefined,
      snippet: post.snippet ?? undefined,
      category: isCategory(slug) ? slug : undefined,
      date: formatDotDate(post.publishedAt) || undefined,
      dateTime: post.publishedAt ?? undefined,
      author: post.author?.name ?? undefined,
      readTime: post.readTime ? t('post.minRead', { minutes: post.readTime }) : undefined,
      image: post.cover?.url ? getMediaUrl(post.cover.url) : undefined,
      imageAlt: post.cover?.alternativeText ?? undefined,
      read: isRead(post.documentId),
    }
  }
}
