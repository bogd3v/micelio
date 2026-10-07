import type { FediverseStats } from '~/interfaces'

const DOCUMENT_ID = /^[\w-]+$/
const MAX_IDS = 50
const UPSTREAM_TIMEOUT_MS = 3000

type UpstreamStats = Record<string, Partial<Record<keyof FediverseStats, unknown>>>

function toCount(value: unknown): number {
  const count = Number(value)
  return Number.isInteger(count) && count > 0 ? count : 0
}

function parseIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  const ids = values
    .flatMap(item => (typeof item === 'string' ? item.split(',') : []))
    .map(id => id.trim())
    .filter(Boolean)
  return [...new Set(ids)]
}

export default defineEventHandler(async (event): Promise<Record<string, FediverseStats>> => {
  const ids = parseIds(getQuery(event).documentIds)

  if (ids.length === 0 || ids.length > MAX_IDS || !ids.every(id => DOCUMENT_ID.test(id))) {
    throw createError({ statusCode: 400, message: `documentIds needs between 1 and ${MAX_IDS} valid ids` })
  }

  let response: UpstreamStats
  try {
    response = await strapiFetch<UpstreamStats>('/api/fediverse/articles/stats', {
      event,
      auth: 'none',
      query: { documentIds: ids.join(',') },
      timeout: UPSTREAM_TIMEOUT_MS,
    })
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    console.error('Strapi fetch fediverse batch stats error:', asUpstreamError(error).data || error)
    throw createError({
      statusCode: 502,
      message: upstreamErrorMessage(error, 'Failed to fetch fediverse stats'),
    })
  }

  setHeader(event, 'Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

  return Object.fromEntries(
    ids
      .filter(id => response?.[id])
      .map(id => [id, { likes: toCount(response[id]!.likes), boosts: toCount(response[id]!.boosts) }]),
  )
})
