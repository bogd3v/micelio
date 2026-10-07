import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { RateLimitRule } from '~/helpers/rateLimit'
import { createRateLimiter } from '~/helpers/rateLimit'
import { INTERNAL_IP_HEADER, INTERNAL_NONCE_HEADER, internalClientIp, parseTrustProxy, resolveClientIp } from '../lib/clientIp'
import type { TrustProxy } from '../lib/clientIp'

const limiter = createRateLimiter()

export const RATE_LIMITS = {
  commentPerIp: { limit: 10, windowMs: 10 * 60 * 1000 },
  newsletterPerIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  newsletterPerEmail: { limit: 3, windowMs: 60 * 60 * 1000 },
} satisfies Record<string, RateLimitRule>

let parsedTrust: { raw: string, value: TrustProxy } | undefined

function trustProxy(raw: unknown): TrustProxy {
  const key = String(raw ?? '')
  if (parsedTrust?.raw !== key) parsedTrust = { raw: key, value: parseTrustProxy(key) }
  return parsedTrust.value
}

/** Per process, never leaves it: proves that an internal (SSR) call really is one. */
export const INTERNAL_NONCE = randomBytes(32).toString('hex')

/**
 * The visitor's address under `NUXT_TRUST_PROXY` (docs/security.md); `unknown`
 * when there is none. An in-process call (SSR, no socket address) takes the
 * address its outer request resolved from the internal headers, if the nonce matches.
 */
export function clientIp(event: H3Event): string {
  // Resolved once: the internal headers are removed after the first read so nothing carries them onward
  const cached = event.context.micelioClientIp as string | undefined
  if (cached) return cached
  const ip = resolveEventIp(event)
  event.context.micelioClientIp = ip
  return ip
}

function resolveEventIp(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const peer = event.node.req.socket?.remoteAddress
  const internal = internalClientIp(
    peer,
    getRequestHeader(event, INTERNAL_IP_HEADER),
    getRequestHeader(event, INTERNAL_NONCE_HEADER),
    INTERNAL_NONCE,
  )
  Reflect.deleteProperty(event.node.req.headers, INTERNAL_IP_HEADER)
  Reflect.deleteProperty(event.node.req.headers, INTERNAL_NONCE_HEADER)
  if (internal) return internal
  const header = getRequestHeader(event, String(config.proxyIpHeader || 'x-forwarded-for'))
  return resolveClientIp(trustProxy(config.trustProxy), peer, header).ip
}

export function assertRateLimit(event: H3Event, bucket: keyof typeof RATE_LIMITS, key: string): void {
  const result = limiter.consume(`${bucket}:${key}`, RATE_LIMITS[bucket])
  if (result.allowed) return
  setHeader(event, 'Retry-After', result.retryAfterSeconds)
  throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
}

/** Longest `Retry-After` echoed to the browser, whatever the CMS says. */
const MAX_RETRY_AFTER_SECONDS = 3600

export function isUpstreamRateLimit(error: unknown): boolean {
  const upstream = asUpstreamError(error)
  return (upstream.response?.status ?? upstream.statusCode) === 429
}

/** Copies the CMS's `Retry-After` (validated, clamped) onto the response. */
export function copyRetryAfter(event: H3Event, error: unknown): void {
  const retryAfter = Number(asUpstreamError(error).response?.headers?.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    setHeader(event, 'Retry-After', Math.min(Math.ceil(retryAfter), MAX_RETRY_AFTER_SECONDS))
  }
}

/**
 * Passes a 429 of the CMS on to the browser with its `Retry-After`, as the
 * route's own limit does, and never cacheable. No-op for any other error.
 */
export function rethrowUpstreamRateLimit(event: H3Event, error: unknown): void {
  if (!isUpstreamRateLimit(error)) return
  copyRetryAfter(event, error)
  setHeader(event, 'Cache-Control', 'no-store')
  throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
}

/** A degraded answer given because the CMS limited us must not be cached. */
export function noStoreOnUpstreamRateLimit(event: H3Event, error: unknown): void {
  if (isUpstreamRateLimit(error)) setHeader(event, 'Cache-Control', 'no-store')
}
