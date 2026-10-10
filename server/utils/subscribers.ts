import qs from 'qs'
import type { H3Event } from 'h3'
import { randomBytes } from 'crypto'
import type { Subscriber } from '~/interfaces/newsletter'

type SubscriberField = 'email' | 'confirmationToken' | 'unsubscribeToken'

/** A new unsubscribe token: 32 random bytes, base64url-encoded to 43 characters. */
export function newUnsubscribeToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * The subscriber whose `field` equals `value` in the CMS, or null when there is none.
 *
 * @remarks
 * Reads one row from `/api/subscribers` with the visitor forwarding headers. `value` is compared as given, so the caller normalizes it first.
 */
export async function findSubscriber(event: H3Event, field: SubscriberField, value: string): Promise<Subscriber | null> {
  const params = qs.stringify({
    filters: { [field]: { $eq: value } },
    pagination: { pageSize: 1 },
  })
  const response = await strapiFetch<{ data: Subscriber[] }>(`/api/subscribers?${params}`, { event })
  return response.data?.[0] ?? null
}

/** Creates a subscriber in the CMS with the fields of `data`. */
export async function createSubscriber(event: H3Event, data: Omit<Subscriber, 'id' | 'documentId' | 'createdAt' | 'updatedAt'>): Promise<void> {
  await strapiFetch('/api/subscribers', {
    event,
    method: 'POST',
    body: { data },
  })
}

/** Sends the fields of `data` to the subscriber with `documentId`. */
export async function updateSubscriber(event: H3Event, documentId: string, data: Partial<Subscriber>): Promise<void> {
  await strapiFetch(`/api/subscribers/${documentId}`, {
    event,
    method: 'PUT',
    body: { data },
  })
}

/** Deletes the subscriber with `documentId` from the CMS. */
export async function deleteSubscriber(event: H3Event, documentId: string): Promise<void> {
  await strapiFetch(`/api/subscribers/${documentId}`, { event, method: 'DELETE' })
}
