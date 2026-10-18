import type { H3Event } from 'h3'
import { createHash, randomBytes } from 'crypto'
import type { Subscriber } from '~/interfaces/newsletter'

type SubscriberField = 'email' | 'confirmationToken' | 'unsubscribeToken'
type SubscriberTokenField = Exclude<SubscriberField, 'email'>

// A stored token is the SHA-256 of what the subscriber holds
const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/

/** A new confirmation token: 32 random bytes (256 bits), base64url-encoded to 43 characters. */
export function newConfirmationToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * What the CMS stores for a token: its SHA-256 as 64 hex characters.
 *
 * @remarks
 * Lookups send this value in the body of the CMS request, never in a URL. A hash of 256 random bits cannot be turned back into the token the subscriber holds, so it cannot be used to confirm or unsubscribe (ASVS V14.2.1).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Whether `stored` looks like a SHA-256 hex digest. */
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
 * Posts `{ field, value }` to `/api/subscribers/lookup` with the visitor forwarding headers, so an email or a token never travels in a URL and never reaches an access log (ASVS V14.2.1). `value` is compared as given, so the caller normalizes it first. Needs a CMS from the release line that serves the route.
 */
export async function findSubscriber(event: H3Event, field: SubscriberField, value: string): Promise<Subscriber | null> {
  const response = await strapiFetch<{ data: Subscriber | null }>('/api/subscribers/lookup', {
    event,
    method: 'POST',
    body: { field, value },
  })
  return response.data ?? null
}

/**
 * The subscriber a confirmation or unsubscribe `token` belongs to, or null when there is none.
 *
 * @remarks
 * Looks the token up by its hash. The CMS hashes the tokens still stored in the clear on boot, so the token as it is is never sent. A token that looks like a hash finds nothing, so a stored hash cannot be used as the token.
 */
export async function findSubscriberByToken(event: H3Event, field: SubscriberTokenField, token: string): Promise<Subscriber | null> {
  if (isHashedToken(token)) return null
  return findSubscriber(event, field, hashToken(token))
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
