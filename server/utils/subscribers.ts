import qs from 'qs'
import type { H3Event } from 'h3'
import { randomBytes } from 'crypto'
import type { Subscriber } from '~/interfaces/newsletter'

type SubscriberField = 'email' | 'confirmationToken' | 'unsubscribeToken'

export function newUnsubscribeToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function findSubscriber(event: H3Event, field: SubscriberField, value: string): Promise<Subscriber | null> {
  const params = qs.stringify({
    filters: { [field]: { $eq: value } },
    pagination: { pageSize: 1 },
  })
  const response = await strapiFetch<{ data: Subscriber[] }>(`/api/subscribers?${params}`, { event })
  return response.data?.[0] ?? null
}

export async function createSubscriber(event: H3Event, data: Omit<Subscriber, 'id' | 'documentId' | 'createdAt' | 'updatedAt'>): Promise<void> {
  await strapiFetch('/api/subscribers', {
    event,
    method: 'POST',
    body: { data },
  })
}

export async function updateSubscriber(event: H3Event, documentId: string, data: Partial<Subscriber>): Promise<void> {
  await strapiFetch(`/api/subscribers/${documentId}`, {
    event,
    method: 'PUT',
    body: { data },
  })
}

export async function deleteSubscriber(event: H3Event, documentId: string): Promise<void> {
  await strapiFetch(`/api/subscribers/${documentId}`, { event, method: 'DELETE' })
}
