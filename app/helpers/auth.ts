import type { AuthErrorCode, AuthNotice, AuthUser, PasswordStrength, StrapiAuthUser } from '../interfaces/auth'

const MIN_PASSWORD_LENGTH = 10
const EDITOR_ROLE_TYPE = 'editor'

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/i
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const AUTH_NOTICES: readonly AuthNotice[] = ['signed-out', 'account-deleted', 'password-reset']

/** Whether a username is 3 to 30 letters, digits, dots, underscores or hyphens, ignoring surrounding spaces. */
export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim())
}

/** Whether a value has the shape of an email address. It does not check that the address exists. */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

/** Whether a password is at least 10 characters long. */
export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH
}

/**
 * The strength of a password, from 0 for an empty value to 4 for the strongest.
 *
 * @remarks
 * 1 is shorter than 10 characters, 2 is shorter than 14, 4 has a whitespace or is 18 characters or longer, and 3 is any other password.
 */
export function passwordStrength(value: string): PasswordStrength {
  if (!value.length) return 0
  if (value.length < MIN_PASSWORD_LENGTH) return 1
  if (value.length < 14) return 2
  if (/\s/.test(value) || value.length >= 18) return 4
  return 3
}

/**
 * The redirect target from a query value when it is a path on this site, or null otherwise.
 *
 * @remarks
 * Only a path that starts with one `/`, has no backslash and no character below U+0020 is kept. An array takes its first value.
 */
export function safeRedirect(value: unknown): string | null {
  const target = Array.isArray(value) ? value[0] : value
  if (typeof target !== 'string' || !target.startsWith('/')) return null
  if (target.startsWith('//') || target.includes('\\')) return null
  if ([...target].some(char => char.charCodeAt(0) < 32)) return null
  return target
}

/**
 * The notice named by a query value when it is a known one (`signed-out`, `account-deleted` or `password-reset`), or null otherwise.
 *
 * @remarks
 * An array takes its first value.
 */
export function authNotice(value: unknown): AuthNotice | null {
  const notice = Array.isArray(value) ? value[0] : value
  return AUTH_NOTICES.find(item => item === notice) ?? null
}

/**
 * Masks an email address, keeping its first character and its domain.
 *
 * @remarks
 * The address is returned unchanged when the part before the `@` has one character or less, or when there is no `@`.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 2) return email
  return `${email.charAt(0)}•••${email.slice(at)}`
}

/** The first letter of a username in capitals, for an avatar. Empty when the username is blank. */
export function userInitial(username: string): string {
  return username.trim().charAt(0).toUpperCase()
}

/**
 * The user fields that the client receives: username, email, role and creation date.
 *
 * @remarks
 * The role is `editor` for an editor and `reader` for any other role.
 */
export function toPublicUser(user: StrapiAuthUser): AuthUser {
  return {
    username: user.username,
    email: user.email,
    role: user.role?.type === EDITOR_ROLE_TYPE ? 'editor' : 'reader',
    createdAt: user.createdAt ?? null,
  }
}

/**
 * The `AuthErrorCode` of an error from Strapi's authentication routes, from its HTTP status and message, or `unknown` when nothing matches.
 *
 * @remarks
 * The message is matched in lower case. A 400 without a known message is `invalidInput`.
 */
export function strapiAuthErrorCode(status: number | undefined, message: string | undefined): AuthErrorCode {
  if (status === 429) return 'tooManyRequests'
  if (status === 401 || status === 403) return 'unauthorized'
  const text = (message ?? '').toLowerCase()
  if (text.includes('not confirmed')) return 'emailNotConfirmed'
  if (text.includes('already taken')) return 'emailTaken'
  if (text.includes('incorrect code')) return 'invalidCode'
  if (text.includes('invalid identifier or password') || text.includes('blocked')) return 'invalidCredentials'
  if (status === 400) return 'invalidInput'
  return 'unknown'
}

/**
 * The `AuthErrorCode` that the server put in an error, or `unknown` when the error has none.
 *
 * @remarks
 * It reads `data.data.code` of an error thrown by a request.
 */
export function authErrorCodeOf(err: unknown): AuthErrorCode {
  const data = (err as { data?: { data?: { code?: AuthErrorCode } } } | null)?.data
  return data?.data?.code ?? 'unknown'
}
