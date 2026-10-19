import type { CategoryEntry } from '~/interfaces'
import { listLocaleQuerySchema } from '../schemas/query'

export default defineEventHandler(async (event): Promise<CategoryEntry[]> => {
  const { locale } = validQuery(event, listLocaleQuerySchema)

  setHeader(event, 'Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')

  const categories = await loadCategories(locale)
  // Listed by hand: a field the loader gains later is not public until it is added here and in the schema
  return categories.map(({ id, slug, name, description, order, featured, color, count }) => ({ id, slug, name, description, order, featured, color, count }))
})
