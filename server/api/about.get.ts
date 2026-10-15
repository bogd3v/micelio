import qs from 'qs'
import type { StrapiAbout, StrapiBlock } from '~/interfaces'
import { renderBlocks } from '~/helpers/markdown'
import { localeQuerySchema } from '../schemas/query'
import { ABOUT_POPULATE } from '../lib/constants'
import { publicAbout } from '../lib/publicShapes'

export default defineEventHandler(async (event) => {
  const { locale } = validQuery(event, localeQuerySchema)

  const params = qs.stringify({ locale, populate: ABOUT_POPULATE }, { skipNulls: true })

  setHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

  let response: { data?: unknown }
  try {
    response = await strapiFetch<{ data?: unknown }>(`/api/about?${params}`, { event })
  } catch (error: unknown) {
    logError('cms.about', 'Fetching the about page failed', { event, error })
    throw upstreamFailure(error, 'Failed to fetch about page')
  }

  const data = response.data as { blocks?: StrapiBlock[] | null } | undefined
  if (!data) {
    throw problem('notFound', { message: 'About page not found' })
  }

  return publicAbout({ ...data, blocks: renderBlocks(data.blocks, markdownRenderer(locale)) } as StrapiAbout)
})
