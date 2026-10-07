import qs from 'qs'
import type { StrapiBlock } from '~/interfaces'
import { renderBlocks } from '~/helpers/markdown'
import { localeQuerySchema } from '../schemas/query'

export default defineEventHandler(async (event) => {
  const { locale } = validQuery(event, localeQuerySchema)

  const params = qs.stringify({
    locale,
    populate: {
      blocks: {
        on: {
          'about.profile': { populate: '*' },
          'about.statement': { populate: '*' },
          'about.topics': { populate: '*' },
          'about.projects': { populate: { projects: { populate: '*' } } },
          'about.principles': { populate: '*' },
          'about.open-source': { populate: '*' },
          'about.contact': { populate: '*' },
          'shared.rich-text': { populate: '*' },
          'shared.quote': { populate: '*' },
          'shared.media': { populate: { file: true, credit: true } },
          'shared.slider': { populate: { items: { populate: { file: true, credit: true } }, files: true } },
        },
      },
      seo: { populate: '*' },
    },
  }, { skipNulls: true })

  setHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

  let response: { data?: unknown }
  try {
    response = await strapiFetch<{ data?: unknown }>(`/api/about?${params}`, { event })
  } catch (error: unknown) {
    console.error('Strapi fetch about error:', asUpstreamError(error).data || error)
    throw createError({
      statusCode: 502,
      message: upstreamErrorMessage(error, 'Failed to fetch about page'),
    })
  }

  const data = response.data as { blocks?: StrapiBlock[] | null } | undefined
  if (!data) {
    throw createError({ statusCode: 404, message: 'About page not found' })
  }

  return { ...data, blocks: renderBlocks(data.blocks, markdownRenderer(locale)) }
})
