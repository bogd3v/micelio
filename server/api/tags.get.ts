import qs from 'qs'
import type { TagCount } from '~/interfaces'
import { sortTags } from '~/helpers/tags'
import { listLocaleQuerySchema } from '../schemas/query'

export default defineEventHandler(async (event): Promise<TagCount[]> => {
  const { locale } = validQuery(event, listLocaleQuerySchema)

  const params = qs.stringify({
    locale,
    pagination: { pageSize: 100 },
    fields: ['name', 'slug'],
    populate: {
      articles: {
        fields: ['id'],
        filters: { locale: { $eq: locale } },
      },
    },
  })

  setHeader(event, 'Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')

  const response = await strapiFetch<{
    data: Array<{
      id: number
      name?: string | null
      slug?: string | null
      articles?: Array<{ id: number }>
    }>
  }>(`/api/tags?${params}`, { event })

  return sortTags(response.data.flatMap((tag) => {
    const count = tag.articles?.length || 0
    if (!tag.slug || !tag.name || count === 0) return []
    return [{ slug: tag.slug, name: tag.name, count }]
  }))
})
