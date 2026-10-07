import qs from 'qs'
import { localeQuerySchema } from '../../schemas/query'
import { pageParamsSchema, parsePage } from '../../schemas/page'

export default defineEventHandler(async (event) => {
  const params = pageParamsSchema.safeParse({ slug: getRouterParam(event, 'slug') })
  if (!params.success) throw invalidQuery(params.error)
  const { slug } = params.data
  const { locale } = validQuery(event, localeQuerySchema)

  const query = qs.stringify({
    filters: { slug: { $eq: slug } },
    locale,
    pagination: { limit: 1 },
    populate: PAGE_POPULATE,
  }, { skipNulls: true })

  let response: { data?: unknown[] }
  try {
    response = await strapiFetch<{ data?: unknown[] }>(`/api/pages?${query}`)
  } catch (error: unknown) {
    console.error('Strapi fetch page error:', asUpstreamError(error).data || error)
    throw createError({
      statusCode: 502,
      message: upstreamErrorMessage(error, 'Failed to fetch page'),
    })
  }

  const page = parsePage(response.data?.[0], markdownRenderer(locale).renderMarkdown)
  if (!page) {
    // Nitro answers errors with `no-cache`, so a missing page is never kept: it may be published any minute
    throw createError({ statusCode: 404, message: 'Page not found' })
  }

  setHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return { ...page, sections: await resolvePostLists(page.sections, locale) }
})
