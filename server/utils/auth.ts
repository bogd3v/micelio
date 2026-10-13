import type { H3Event } from 'h3'
import type { AuthErrorCode, StrapiAuthUser } from '~/interfaces/auth'
import { strapiAuthErrorCode } from '~/helpers/auth'
import { LEGACY_SESSION_COOKIE, PREVIOUS_SESSION_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE } from '~/constants/auth'
import { trustsForwardedHost } from '../lib/clientIp'

const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  invalidCredentials: 400,
  emailNotConfirmed: 400,
  emailTaken: 409,
  tooManyRequests: 429,
  invalidCode: 400,
  wrongPassword: 400,
  weakPassword: 400,
  commonPassword: 400,
  invalidInput: 400,
  unauthorized: 401,
  forbiddenOrigin: 403,
  unknown: 502,
}

/** The error of an auth route for `code`: the status of that code, with the code as the status message and in `data.code`. It is returned, so the caller throws it. */
export function authFailure(code: AuthErrorCode) {
  return createError({ statusCode: AUTH_ERROR_STATUS[code], statusMessage: code, data: { code } })
}

/**
 * Turns a failed CMS call into the auth error of the route, and returns it so the caller throws it.
 *
 * @remarks
 * The code comes from the CMS status and message through `strapiAuthErrorCode`. `overrides` renames a code for one route, for example `invalidInput` to `invalidCredentials` on login. A 429 copies the CMS `Retry-After` onto the response. An unrecognised failure is logged with `console.error`, with the CMS status and message.
 */
export function strapiAuthFailure(event: H3Event, err: unknown, overrides: Partial<Record<AuthErrorCode, AuthErrorCode>> = {}) {
  const e = asUpstreamError(err)
  const status = e.response?.status
  const code = strapiAuthErrorCode(status, e.data?.error?.message)
  if (code === 'tooManyRequests') copyRetryAfter(event, err)
  if (code === 'unknown') console.error('Strapi auth error:', status, e.data?.error?.message || e.message)
  return authFailure(overrides[code] ?? code)
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
  if (!origin || !allowed.includes(origin)) throw authFailure('forbiddenOrigin')
}

function originOf(url: string): string | null {
  return URL.canParse(url) ? new URL(url).origin : null
}

/** Attributes shared by the session cookie and the one that clears it (ADR 0003). */
const SESSION_COOKIE_ATTRIBUTES = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const

/** The session JWT of the request: `__Host-micelio_session`, else the cookie of the previous release (`micelio_session`), else the pre-rename `bd_session`. */
export function getSessionToken(event: H3Event): string | null {
  // TODO(#422): remove the micelio_session and bd_session fallbacks
  return getCookie(event, SESSION_COOKIE) || getCookie(event, PREVIOUS_SESSION_COOKIE) || getCookie(event, LEGACY_SESSION_COOKIE) || null
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

/** Expires the session cookie and the two it replaced, so the visitor is signed out. */
export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES)
  // TODO(#422): remove with the fallbacks. Without them a stale old cookie would sign the visitor back in
  deleteCookie(event, PREVIOUS_SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES)
  deleteCookie(event, LEGACY_SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES)
}

/**
 * Re-issues a session that only exists under `micelio_session` or `bd_session` as `__Host-micelio_session` and clears the old cookie, so nobody is signed out by the rename.
 *
 * @remarks
 * Called once per request by `server/middleware/session-rename.ts`, before the route. A route that sets or clears
 * `__Host-micelio_session` afterwards replaces this cookie (same name, path and domain), so login, logout and deletion win.
 * The response is `private, no-store`: it carries a `Set-Cookie`.
 */
export function migrateLegacySession(event: H3Event): void {
  // TODO(#422): remove with the fallbacks
  if (getCookie(event, SESSION_COOKIE)) return
  const old = [PREVIOUS_SESSION_COOKIE, LEGACY_SESSION_COOKIE].filter(name => getCookie(event, name))
  if (!old.length) return
  preventCaching(event)
  setSessionCookie(event, getCookie(event, old[0]!)!)
  for (const name of old) deleteCookie(event, name, SESSION_COOKIE_ATTRIBUTES)
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
