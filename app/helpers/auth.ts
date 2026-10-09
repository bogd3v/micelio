import type { AuthErrorCode, AuthNotice, AuthUser, PasswordStrength, StrapiAuthUser } from '../interfaces/auth'

export const MIN_PASSWORD_LENGTH = 10
export const EDITOR_ROLE_TYPE = 'editor'

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/i
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const AUTH_NOTICES: readonly AuthNotice[] = ['signed-out', 'account-deleted', 'password-reset']

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim())
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH
}

export function passwordStrength(value: string): PasswordStrength {
  if (!value.length) return 0
  if (value.length < MIN_PASSWORD_LENGTH) return 1
  if (value.length < 14) return 2
  if (/\s/.test(value) || value.length >= 18) return 4
  return 3
}

export function safeRedirect(value: unknown): string | null {
  const target = Array.isArray(value) ? value[0] : value
  if (typeof target !== 'string' || !target.startsWith('/')) return null
  if (target.startsWith('//') || target.includes('\\')) return null
  if ([...target].some(char => char.charCodeAt(0) < 32)) return null
  return target
}

export function authNotice(value: unknown): AuthNotice | null {
  const notice = Array.isArray(value) ? value[0] : value
  return AUTH_NOTICES.find(item => item === notice) ?? null
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 2) return email
  return `${email.charAt(0)}•••${email.slice(at)}`
}

export function userInitial(username: string): string {
  return username.trim().charAt(0).toUpperCase()
}

export function toPublicUser(user: StrapiAuthUser): AuthUser {
  return {
    username: user.username,
    email: user.email,
    role: user.role?.type === EDITOR_ROLE_TYPE ? 'editor' : 'reader',
    createdAt: user.createdAt ?? null,
  }
}

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

export function authErrorCodeOf(err: unknown): AuthErrorCode {
  const data = (err as { data?: { data?: { code?: AuthErrorCode } } } | null)?.data
  return data?.data?.code ?? 'unknown'
}
