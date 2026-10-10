import type { ComputedRef } from 'vue'
import type { Category, NumberedReference, StrapiPost, TocHeading } from '~/interfaces'
import { numberReferences } from '~/helpers/citations'
import { isCategory } from '~/helpers/categories'
import { formatDotDate } from '~/helpers/formatDate'
import { mastodonShareUrl } from '~/helpers/share'
import { extractHeadings } from '~/helpers/toc'

interface ArticleProps {
  post: StrapiPost
  shareUrl: string
  draft: boolean
}

interface ArticleState {
  coverUrl: ComputedRef<string>
  category: ComputedRef<Category | undefined>
  references: ComputedRef<NumberedReference[]>
  headings: ComputedRef<TocHeading[]>
  mastodonUrl: ComputedRef<string>
  publishedDate: ComputedRef<string>
  federated: ComputedRef<boolean>
  readDocumentId: ComputedRef<string | undefined>
}

/** What the article variants derive from the post, so each keeps only its template. */
export function useArticleState(props: ArticleProps): ArticleState {
  const { locale, t } = useI18n()
  const { getMediaUrl } = useStrapi()
  const config = useRuntimeConfig()
  const fediverseOn = useModule('fediverse')

  const coverUrl = computed<string>(() => props.post.cover ? getMediaUrl(props.post.cover) : '')
  const category = computed<Category | undefined>(() => {
    const slug = props.post.category?.slug
    return isCategory(slug) ? slug : undefined
  })
  const references = computed<NumberedReference[]>(() => numberReferences(props.post.blocks, props.post.references))
  const headings = computed<TocHeading[]>(() => {
    const blockHeadings = extractHeadings(props.post.blocks)
    if (!references.value.length) return blockHeadings
    return [...blockHeadings, { id: 'references', text: t('post.references.title'), level: 2 }]
  })
  const mastodonUrl = computed<string>(() => mastodonShareUrl(props.post.title, props.shareUrl))
  const publishedDate = computed<string>(() => formatDotDate(props.post.publishedAt))
  const federated = computed<boolean>(() => fediverseOn.value && !props.draft && locale.value === config.public.fediverseLocale && Boolean(props.post.documentId))
  const readDocumentId = computed<string | undefined>(() => props.draft ? undefined : props.post.documentId)

  return { coverUrl, category, references, headings, mastodonUrl, publishedDate, federated, readDocumentId }
}
