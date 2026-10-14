import qs from 'qs'
import type { H3Event } from 'h3'
import { createHash, randomBytes } from 'crypto'
import type { Subscriber } from '~/interfaces/newsletter'

type SubscriberField = 'email' | 'confirmationToken' | 'unsubscribeToken'
type SubscriberTokenField = Exclude<SubscriberField, 'email'>

// A stored token is the SHA-256 of what the subscriber holds; anything else is a token stored in the clear before hashing
const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/

/** A new confirmation token: 32 random bytes (256 bits), base64url-encoded to 43 characters. */
export function newConfirmationToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * What the CMS stores for a token: its SHA-256 as 64 hex characters.
 *
 * @remarks
 * Lookups send this value in the query string of the CMS request, where it ends up in access logs. A hash of 256 random bits cannot be turned back into the token the subscriber holds, so it cannot be used to confirm or unsubscribe (ASVS V14.2.1).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Whether a stored token is a hash and not a token stored in the clear before hashing. */
export function isHashedToken(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && TOKEN_HASH_PATTERN.test(stored)
}

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

/**
 * The subscriber a confirmation or unsubscribe `token` belongs to, or null when there is none.
 *
 * @remarks
 * Looks the token up by its hash. When nothing matches it tries the token as it is, for subscribers stored before tokens were hashed (their emailed links keep working); that second query carries the token in the clear, as before. A token that looks like a hash never takes that path, so a stored hash cannot be used as the token.
 */
export async function findSubscriberByToken(event: H3Event, field: SubscriberTokenField, token: string): Promise<Subscriber | null> {
  const hashed = await findSubscriber(event, field, hashToken(token))
  if (hashed) return hashed
  if (isHashedToken(token)) return null
  const legacy = await findSubscriber(event, field, token)
  return legacy && !isHashedToken(legacy[field]) ? legacy : null
}

/** Creates a subscriber in the CMS with the fields of `data` and returns its `documentId`. */
export async function createSubscriber(event: H3Event, data: Omit<Subscriber, 'id' | 'documentId' | 'createdAt' | 'updatedAt' | 'unsubscribeToken'>): Promise<string> {
  const response = await strapiFetch<{ data: Pick<Subscriber, 'documentId'> }>('/api/subscribers', {
    event,
    method: 'POST',
    body: { data },
  })
  return response.data.documentId
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
