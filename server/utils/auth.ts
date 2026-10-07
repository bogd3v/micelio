import type { H3Event } from 'h3'
import type { AuthErrorCode, StrapiAuthUser } from '~/interfaces/auth'
import { SESSION_COOKIE, SESSION_MAX_AGE, strapiAuthErrorCode } from '~/helpers/auth'

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

export function getSessionToken(event: H3Event): string | null {
  return getCookie(event, SESSION_COOKIE) || null
}

export function setSessionCookie(event: H3Event, jwt: string): void {
  setCookie(event, SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
}

export function fetchStrapiMe(event: H3Event, jwt: string): Promise<StrapiAuthUser> {
  return strapiFetch<StrapiAuthUser>('/api/users/me', { event, auth: { jwt }, query: { populate: 'role' } })
}
