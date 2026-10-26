import qs from 'qs'
import type { H3Event } from 'h3'
import type { DraftArticleResponse, Locale, PublishedVersion, RawStrapiArticle } from '~/interfaces'
import { renderArticleBlocks } from '~/helpers/markdown'
import { withoutIndex } from '~/helpers/preview'
import { ARTICLE_POPULATE } from '../../lib/constants'
import { publicArticle } from '../../lib/publicShapes'

async function fetchPublishedVersion(event: H3Event, jwt: string, path: string, locale: Locale | undefined): Promise<PublishedVersion | null> {
  const query = qs.stringify({ status: 'published', locale, fields: ['slug', 'updatedAt', 'publishedAt'] }, { skipNulls: true })
  try {
    const response = await fetchAsEditor<{ data?: PublishedVersion | null }>(event, jwt, path, query)
    const version = response.data
    return version?.slug ? { slug: version.slug, updatedAt: version.updatedAt ?? null, publishedAt: version.publishedAt ?? null } : null
  } catch {
    // Not silent: `fetchAsEditor` logged the failure (a 401 or 403 as `authz.draft-refused`, anything unexpected as `cms.drafts`) before it threw, and a 404 only means there is no published version
    return null
  }
}

function draftArticle(raw: RawStrapiArticle, locale: Locale | undefined): RawStrapiArticle {
  return publicArticle({ ...raw, blocks: renderArticleBlocks(raw.blocks, raw.references, markdownRenderer(locale)) })
}

export default defineEventHandler(async (event): Promise<DraftArticleResponse> => {
  preventCaching(event)
  const documentId = getRouterParam(event, 'documentId')
  if (!documentId) throw draftNotFound()
  const locale = draftLocale(event)

  // A report in process hands its draft down (ADR 0019, amendment of 2026-10-25); otherwise a grant (the admin's iframe) shows the one document it names, and the published version is the editor's to compare, so there is none
  const inherited = previewContextDraft<RawStrapiArticle>(event, 'article', documentId)
  const grant = inherited ? null : previewAdminOrigin() ? previewGrantOf(event) : null
  if (inherited || grant) {
    const raw = inherited ?? (await fetchPreviewDraft<RawStrapiArticle>(event, grant!, documentId, { populate: ARTICLE_POPULATE })).data
    // The weight report renders the draft once per block without it (`withoutIndex`); only a grant may ask
    const without = withoutIndex(getQuery(event).without)
    const blocks = without === undefined ? raw.blocks : raw.blocks?.filter((_, index) => index !== without)
    return { article: draftArticle({ ...raw, blocks }, locale), published: null, ...(grant && { preview: draftPreview() }) }
  }

  const jwt = editorSession(event)
  const path = `/api/articles/${encodeURIComponent(documentId)}`
  const query = qs.stringify({ status: 'draft', locale, populate: ARTICLE_POPULATE }, { skipNulls: true })

  const [draft, published] = await Promise.all([
    fetchAsEditor<{ data?: RawStrapiArticle | null }>(event, jwt, path, query),
    fetchPublishedVersion(event, jwt, path, locale),
  ])
  if (!draft.data) throw draftNotFound()

  return { article: draftArticle(draft.data, locale), published }
})
