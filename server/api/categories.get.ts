import type { CategoryCount } from '~/interfaces'
import { listLocaleQuerySchema } from '../schemas/query'

export default defineEventHandler(async (event): Promise<CategoryCount[]> => {
  const { locale } = validQuery(event, listLocaleQuerySchema)

  setHeader(event, 'Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')

  const categories = await loadCategories(locale)
  return categories.map(({ id, slug, name, count }) => ({ id, slug, name, count }))
})
