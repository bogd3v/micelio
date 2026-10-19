import type { CategoryEntry } from '~/interfaces'
import { listLocaleQuerySchema } from '../schemas/query'

export default defineEventHandler(async (event): Promise<CategoryEntry[]> => {
  const { locale } = validQuery(event, listLocaleQuerySchema)

  setHeader(event, 'Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')

  return loadCategories(locale)
})
