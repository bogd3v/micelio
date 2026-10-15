import { deleteSubscriber, findSubscriberByToken } from '../../utils/subscribers'
import { isNewsletterToken } from '~/helpers/newsletter'
import type { UnsubscribeResponse } from '~/interfaces/newsletter'

async function readToken(event: Parameters<typeof getQuery>[0]): Promise<unknown> {
  const fromQuery = getQuery(event).token
  if (fromQuery) return fromQuery
  try {
    const body = await readLimitedBody(event) as { token?: unknown } | null | undefined
    return body?.token
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 413) throw error
    return undefined
  }
}

export default defineEventHandler(async (event): Promise<UnsubscribeResponse> => {
  const token = await readToken(event)

  if (!isNewsletterToken(token)) {
    logWarn('input.refused', 'Unsubscribe token refused', { event, cause: 'invalidToken' })
    throw problem('invalidToken', { statusMessage: 'Invalid unsubscribe token' })
  }

  try {
    const subscriber = await findSubscriberByToken(event, 'unsubscribeToken', token)
    if (subscriber) await deleteSubscriber(event, subscriber.documentId)
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    logError('cms.newsletter-unsubscribe', 'Unsubscribing failed', { event, error })
    throw problem('upstreamUnavailable', { statusMessage: 'Could not unsubscribe' })
  }

  return { success: true }
})
