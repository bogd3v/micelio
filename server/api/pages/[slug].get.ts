import { localeQuerySchema } from '../../schemas/query'
import { pageParamsSchema } from '../../schemas/page'

export default defineEventHandler(async (event) => {
  const params = pageParamsSchema.safeParse({ slug: getRouterParam(event, 'slug') })
  if (!params.success) throw invalidQuery(params.error)
  const { locale } = validQuery(event, localeQuerySchema)

  // Cached in Nitro's storage by loadPage (5 min); not found and errors are never stored
  const page = await loadPage(params.data.slug, locale)
  if (!page) {
    throw createError({ statusCode: 404, message: 'Page not found' })
  }

  setHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return page
})
