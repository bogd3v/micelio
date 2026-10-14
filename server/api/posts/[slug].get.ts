import qs from 'qs'
import type { RawStrapiArticle } from '~/interfaces'
import { renderArticleBlocks } from '~/helpers/markdown'
import { localeQuerySchema, postParamsSchema } from '../../schemas/query'
import { ARTICLE_POPULATE } from '../../lib/constants'

export default defineEventHandler(async (event) => {
  const route = postParamsSchema.safeParse({ slug: getRouterParam(event, 'slug') })
  if (!route.success) throw invalidQuery(route.error)
  const { slug } = route.data
  const { locale } = validQuery(event, localeQuerySchema)

  const params = qs.stringify({
    filters: { slug: { $eq: slug } },
    locale,
    populate: ARTICLE_POPULATE,
  }, { skipNulls: true })

  setHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

  let response: { data?: RawStrapiArticle[] }
  try {
    response = await strapiFetch<{ data?: RawStrapiArticle[] }>(
      `/api/articles?${params}`,
      { event },
    )
  } catch (error: unknown) {
    console.error('Strapi fetch post error:', upstreamLogMessage(error))
    throw upstreamFailure(error, 'Failed to fetch post')
  }

  const data = response.data
  if (!data || data.length === 0) {
    throw createError({ statusCode: 404, message: 'Post not found' })
  }

  const article = data[0]!
  return { ...article, blocks: renderArticleBlocks(article.blocks, article.references, markdownRenderer(locale)) }
})
