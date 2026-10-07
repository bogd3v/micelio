import qs from 'qs'
import type { CategoryCount } from '~/interfaces'
import { categoryOrder, isCategory } from '~/helpers/categories'
import { listLocaleQuerySchema } from '../schemas/query'

export default defineEventHandler(async (event): Promise<CategoryCount[]> => {
  const { locale } = validQuery(event, listLocaleQuerySchema)

  const params = qs.stringify({
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
      name: string
      slug?: string | null
      articles?: Array<{ id: number }>
    }>
  }>(`/api/categories?${params}`, { event })

  return response.data
    .map(category => ({
      id: category.id,
      slug: category.slug ?? null,
      name: category.name,
      count: category.articles?.length || 0,
    }))
    .filter(category => isCategory(category.slug) || category.count > 0)
    .sort((a, b) => categoryOrder(a.slug) - categoryOrder(b.slug) || b.count - a.count)
})
