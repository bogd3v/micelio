import qs from 'qs'
import type { H3Event } from 'h3'
import type { DraftArticleResponse, Locale, PublishedVersion, RawStrapiArticle } from '~/interfaces'
import { renderArticleBlocks } from '~/helpers/markdown'
import { ARTICLE_POPULATE } from '../../lib/constants'

async function fetchPublishedVersion(event: H3Event, jwt: string, path: string, locale: Locale | undefined): Promise<PublishedVersion | null> {
  const query = qs.stringify({ status: 'published', locale, fields: ['slug', 'updatedAt', 'publishedAt'] }, { skipNulls: true })
  try {
    const response = await fetchAsEditor<{ data?: PublishedVersion | null }>(event, jwt, path, query)
    const version = response.data
    return version?.slug ? { slug: version.slug, updatedAt: version.updatedAt ?? null, publishedAt: version.publishedAt ?? null } : null
  } catch {
    return null
  }
}

export default defineEventHandler(async (event): Promise<DraftArticleResponse> => {
  preventCaching(event)
  const jwt = editorSession(event)
  const documentId = getRouterParam(event, 'documentId')
  if (!documentId) throw draftNotFound()

  const locale = draftLocale(event)
  const path = `/api/articles/${encodeURIComponent(documentId)}`
  const query = qs.stringify({ status: 'draft', locale, populate: ARTICLE_POPULATE }, { skipNulls: true })

  const [draft, published] = await Promise.all([
    fetchAsEditor<{ data?: RawStrapiArticle | null }>(event, jwt, path, query),
    fetchPublishedVersion(event, jwt, path, locale),
  ])
  if (!draft.data) throw draftNotFound()

  const article = { ...draft.data, blocks: renderArticleBlocks(draft.data.blocks, draft.data.references, markdownRenderer(locale)) }
  return { article, published }
})
