import { deleteSubscriber, findSubscriber } from '../../utils/subscribers'
import { isNewsletterToken } from '~/helpers/newsletter'
import type { UnsubscribeResponse } from '~/interfaces/newsletter'

async function readToken(event: Parameters<typeof getQuery>[0]): Promise<unknown> {
  const fromQuery = getQuery(event).token
  if (fromQuery) return fromQuery
  try {
    const body = await readBody<{ token?: unknown } | null>(event)
    return body?.token
  } catch {
    return undefined
  }
}

export default defineEventHandler(async (event): Promise<UnsubscribeResponse> => {
  const token = await readToken(event)

  if (!isNewsletterToken(token)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid unsubscribe token',
    })
  }

  try {
    const subscriber = await findSubscriber(event, 'unsubscribeToken', token)
    if (subscriber) await deleteSubscriber(event, subscriber.documentId)
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    console.error('Newsletter unsubscribe error:', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not unsubscribe',
    })
  }

  return { success: true }
})
