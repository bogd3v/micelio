import type { H3Event } from 'h3'
import type { AuthErrorCode, StrapiAuthUser } from '~/interfaces/auth'
import { strapiAuthErrorCode } from '~/helpers/auth'
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE } from '~/constants/auth'

const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  invalidCredentials: 400,
  emailNotConfirmed: 400,
  emailTaken: 409,
  tooManyRequests: 429,
  invalidCode: 400,
  wrongPassword: 400,
  invalidInput: 400,
  unauthorized: 401,
  forbiddenOrigin: 403,
  unknown: 502,
}

export function authFailure(code: AuthErrorCode) {
  return createError({ statusCode: AUTH_ERROR_STATUS[code], statusMessage: code, data: { code } })
}

/** The auth calls may send mail inside Strapi (register, password reset), so they wait longer than a read. */
export const AUTH_TIMEOUT_MS = 30_000

export function strapiAuthFailure(event: H3Event, err: unknown, overrides: Partial<Record<AuthErrorCode, AuthErrorCode>> = {}) {
  const e = asUpstreamError(err)
  const status = e.response?.status
  const code = strapiAuthErrorCode(status, e.data?.error?.message)
  if (code === 'tooManyRequests') copyRetryAfter(event, err)
  if (code === 'unknown') console.error('Strapi auth error:', status, e.data?.error?.message || e.message)
  return authFailure(overrides[code] ?? code)
}

export function preventCaching(event: H3Event): void {
  setHeader(event, 'Cache-Control', 'private, no-store')
}

export function assertSameOrigin(event: H3Event): void {
  const origin = getRequestHeader(event, 'origin')
  const allowed = [
    getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin,
    originOf(useRuntimeConfig(event).public.siteUrl),
  ]
  if (!origin || !allowed.includes(origin)) throw authFailure('forbiddenOrigin')
}

function originOf(url: string): string | null {
  return URL.canParse(url) ? new URL(url).origin : null
}

/** Attributes shared by the session cookie and the one that clears it (ADR 0003). */
const SESSION_COOKIE_ATTRIBUTES = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const

/** The session JWT of the request: `micelio_session`, else the pre-rename `bd_session`. */
export function getSessionToken(event: H3Event): string | null {
  // TODO(#422): remove the bd_session fallback
  return getCookie(event, SESSION_COOKIE) || getCookie(event, LEGACY_SESSION_COOKIE) || null
}

export function setSessionCookie(event: H3Event, jwt: string): void {
  setCookie(event, SESSION_COOKIE, jwt, { ...SESSION_COOKIE_ATTRIBUTES, maxAge: SESSION_MAX_AGE })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES)
  // TODO(#422): remove with the bd_session fallback. Without it a stale bd_session would sign the visitor back in
  deleteCookie(event, LEGACY_SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES)
}

/**
 * Re-issues a session that only exists under `bd_session` as `micelio_session` and clears the old cookie, so nobody is signed out by the rename.
 *
 * @remarks
 * Called once per request by `server/middleware/session-rename.ts`, before the route. A route that sets or clears
 * `micelio_session` afterwards replaces this cookie (same name, path and domain), so login, logout and deletion win.
 * The response is `private, no-store`: it carries a `Set-Cookie`.
 */
export function migrateLegacySession(event: H3Event): void {
  // TODO(#422): remove with the bd_session fallback
  if (getCookie(event, SESSION_COOKIE)) return
  const legacy = getCookie(event, LEGACY_SESSION_COOKIE)
  if (!legacy) return
  preventCaching(event)
  setSessionCookie(event, legacy)
  deleteCookie(event, LEGACY_SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES)
}

export function fetchStrapiMe(event: H3Event, jwt: string): Promise<StrapiAuthUser> {
  return strapiFetch<StrapiAuthUser>('/api/users/me', { event, auth: { jwt }, query: { populate: 'role' } })
}
