import type { H3Event } from 'h3'
import type { AuthErrorCode, StrapiAuthUser } from '~/interfaces/auth'
import { strapiAuthErrorCode } from '~/helpers/auth'
import { SESSION_COOKIE, SESSION_MAX_AGE } from '~/constants/auth'
import { trustsForwardedHost } from '../lib/clientIp'

/** The error of an auth route for `code`: the status of that code in `PROBLEM_CODES`, with the code as the status message and in `data.code`. It is returned, so the caller throws it. */
export function authFailure(code: AuthErrorCode): ReturnType<typeof problem> {
  return problem(code, { statusMessage: code })
}

/**
 * Turns a failed CMS call into the auth error of the route, and returns it so the caller throws it.
 *
 * @remarks
 * The code comes from the CMS status and message through `strapiAuthErrorCode`. `overrides` renames a code for one route, for example `invalidInput` to `invalidCredentials` on login. A 429 copies the CMS `Retry-After` onto the response. Every code but `unknown` is logged as `auth.failure` with the code as `cause` (docs/security.md, "Security events"). An unrecognised failure is logged (`cms.auth`) with the CMS status and message.
 */
export function strapiAuthFailure(event: H3Event, err: unknown, overrides: Partial<Record<AuthErrorCode, AuthErrorCode>> = {}): ReturnType<typeof problem> {
  const e = asUpstreamError(err)
  const status = e.response?.status
  const code = strapiAuthErrorCode(status, e.data?.error?.message)
  if (code === 'tooManyRequests') copyRetryAfter(event, err)
  if (code === 'unknown') logError('cms.auth', 'Auth call failed', { event, error: err })
  const final = overrides[code] ?? code
  if (final !== 'unknown') logWarn('auth.failure', 'Authentication call refused', { event, cause: final })
  return authFailure(final)
}

/** Marks the response as `private, no-store`, so neither a shared cache nor the browser keeps it. */
export function preventCaching(event: H3Event): void {
  setHeader(event, 'Cache-Control', 'private, no-store')
}

/**
 * Throws the 403 `forbiddenOrigin` error unless the request `Origin` is the site origin.
 *
 * @remarks
 * The site origin is the request origin (read through `X-Forwarded-Host` and `X-Forwarded-Proto` only from a proxy `NUXT_TRUST_PROXY` trusts) or the origin of `siteUrl`. A request without an `Origin` header is refused. The auth, comment and subscribe routes call this first; the one-click unsubscribe route does not, since mail clients send no `Origin`.
 *
 * A refusal is logged as `authz.origin-refused`.
 */
export function assertSameOrigin(event: H3Event): void {
  const origin = getRequestHeader(event, 'origin')
  const config = useRuntimeConfig(event)
  // The forwarded host and protocol count only from a proxy the operator trusts (`NUXT_TRUST_PROXY`), like the forwarded address
  const forwarded = trustsForwardedHost(trustProxy(config.trustProxy), event.node.req.socket?.remoteAddress)
  const allowed = [
    getRequestURL(event, { xForwardedHost: forwarded, xForwardedProto: forwarded }).origin,
    originOf(config.public.siteUrl),
  ]
  if (!origin || !allowed.includes(origin)) {
    logWarn('authz.origin-refused', 'Request from another origin refused', { event })
    throw authFailure('forbiddenOrigin')
  }
}

function originOf(url: string): string | null {
  return URL.canParse(url) ? new URL(url).origin : null
}

/** Attributes shared by the session cookie and the one that clears it (ADR 0003). */
const SESSION_COOKIE_ATTRIBUTES = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const

/** The session JWT of the request, from `__Host-micelio_session`, or `null` when the cookie is absent. */
export function getSessionToken(event: H3Event): string | null {
  return getCookie(event, SESSION_COOKIE) || null
}

/**
 * Sets the session cookie `__Host-micelio_session` with the CMS JWT, for `SESSION_MAX_AGE` seconds.
 *
 * @remarks
 * The cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, sent to the whole site and to this host only, as the `__Host-` prefix requires (ADR 0003).
 */
export function setSessionCookie(event: H3Event, jwt: string): void {
  setCookie(event, SESSION_COOKIE, jwt, { ...SESSION_COOKIE_ATTRIBUTES, maxAge: SESSION_MAX_AGE })
}

/** Expires the session cookie `__Host-micelio_session`, so the visitor is signed out. */
export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES)
}

/**
 * Reads the signed-in user of a JWT from `GET /api/users/me`, with the role populated.
 *
 * @remarks
 * The JWT is sent as the bearer, not the API token. A rejected call rejects with the CMS error; the routes turn it with `strapiAuthFailure`, and `GET /api/auth/me` clears the session on a 401 or 403.
 */
export function fetchStrapiMe(event: H3Event, jwt: string): Promise<StrapiAuthUser> {
  return strapiFetch<StrapiAuthUser>('/api/users/me', { event, auth: { jwt }, query: { populate: 'role' } })
}
