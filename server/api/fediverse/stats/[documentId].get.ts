import type { FediverseStats } from '~/interfaces'

const DOCUMENT_ID = /^[\w-]+$/
const UPSTREAM_TIMEOUT_MS = 3000

function toCount(value: unknown): number {
  const count = Number(value)
  return Number.isInteger(count) && count > 0 ? count : 0
}

export default defineEventHandler(async (event): Promise<FediverseStats> => {
  const documentId = getRouterParam(event, 'documentId') ?? ''

  if (!DOCUMENT_ID.test(documentId)) {
    throw problem('invalidRequest', { message: 'Invalid document id' })
  }

  let response: Partial<Record<keyof FediverseStats, unknown>>
  try {
    response = await strapiFetch<Partial<Record<keyof FediverseStats, unknown>>>(
      `/api/fediverse/articles/${documentId}/stats`,
      { event, auth: 'none', timeout: UPSTREAM_TIMEOUT_MS },
    )
  } catch (error: unknown) {
    const status = asUpstreamError(error).response?.status
    if (status === 404) {
      throw problem('notFound', { message: 'Article not federated' })
    }
    rethrowUpstreamRateLimit(event, error)
    logError('cms.fediverse-stats', 'Fetching the fediverse stats failed', { event, error })
    throw upstreamFailure(error, 'Failed to fetch fediverse stats')
  }

  setHeader(event, 'Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

  return { likes: toCount(response?.likes), boosts: toCount(response?.boosts) }
})
