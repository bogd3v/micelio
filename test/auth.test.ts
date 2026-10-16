import { describe, expect, it } from 'vitest'
import {
  authErrorCodeOf,
  authNotice,
  isEmailConfirmationToken,
  isValidEmail,
  isPasswordTooLong,
  isValidPassword,
  isValidUsername,
  maskEmail,
  passwordStrength,
  safeRedirect,
  strapiAuthErrorCode,
  toPublicUser,
  userInitial,
} from '~/helpers/auth'

describe('safeRedirect', () => {
  it('keeps internal paths with their query and hash', () => {
    expect(safeRedirect('/account')).toBe('/account')
    expect(safeRedirect('/es/blog?category=ia#posts')).toBe('/es/blog?category=ia#posts')
    expect(safeRedirect(['/blog', '/about'])).toBe('/blog')
  })

  it('drops external, protocol-relative and malformed targets', () => {
    expect(safeRedirect('https://otro.sitio')).toBeNull()
    expect(safeRedirect('//otro.sitio/account')).toBeNull()
    expect(safeRedirect('/\\otro.sitio')).toBeNull()
    expect(safeRedirect('javascript:alert(1)')).toBeNull()
    expect(safeRedirect('/account\n')).toBeNull()
    expect(safeRedirect('account')).toBeNull()
    expect(safeRedirect(undefined)).toBeNull()
    expect(safeRedirect(null)).toBeNull()
  })
})

describe('authNotice', () => {
  it('accepts only the known notices', () => {
    expect(authNotice('signed-out')).toBe('signed-out')
    expect(authNotice(['account-deleted'])).toBe('account-deleted')
    expect(authNotice('password-reset')).toBe('password-reset')
    expect(authNotice('<script>')).toBeNull()
    expect(authNotice(undefined)).toBeNull()
  })
})

describe('validators', () => {
  it('checks usernames of 3 to 30 letters, numbers, dots or hyphens', () => {
    expect(isValidUsername('lectora')).toBe(true)
    expect(isValidUsername('ana.maria-2')).toBe(true)
    expect(isValidUsername('ab')).toBe(false)
    expect(isValidUsername('a'.repeat(31))).toBe(false)
    expect(isValidUsername('ana maria')).toBe(false)
  })

  it('checks emails and the 10-character password minimum', () => {
    expect(isValidEmail('nombre@correo.co')).toBe(true)
    expect(isValidEmail('nombre@correo')).toBe(false)
    expect(isValidPassword('123456789')).toBe(false)
    expect(isValidPassword('1234567890')).toBe(true)
  })

  it('accepts at most 72 bytes, which is what the CMS can hash, counting a letter with an accent as two and an emoji as four', () => {
    expect(isValidPassword('a'.repeat(72))).toBe(true)
    expect(isValidPassword('a'.repeat(73))).toBe(false)
    expect(isValidPassword('é'.repeat(36))).toBe(true)
    expect(isValidPassword('é'.repeat(37))).toBe(false)
    expect(isValidPassword('😀'.repeat(19))).toBe(false)
    expect(isPasswordTooLong('a'.repeat(73))).toBe(true)
    expect(isPasswordTooLong('a'.repeat(72))).toBe(false)
    expect(isPasswordTooLong('corta')).toBe(false)
  })
})

describe('passwordStrength', () => {
  it('grades length and long phrases in four steps', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('corta')).toBe(1)
    expect(passwordStrength('diezletras')).toBe(2)
    expect(passwordStrength('catorceletras1')).toBe(3)
    expect(passwordStrength('una frase')).toBe(1)
    expect(passwordStrength('frase con espacio')).toBe(4)
    expect(passwordStrength('dieciocholetrasxxx')).toBe(4)
  })
})

describe('toPublicUser', () => {
  it('keeps only the public fields and maps the Strapi role', () => {
    const user = toPublicUser({
      id: 102,
      username: 'alejandro',
      email: 'alejandro@example.com',
      confirmed: true,
      blocked: false,
      createdAt: '2026-01-15T15:00:00.000Z',
      role: { type: 'editor' },
    })
    expect(user).toEqual({ username: 'alejandro', email: 'alejandro@example.com', role: 'editor', createdAt: '2026-01-15T15:00:00.000Z' })
    expect(toPublicUser({ id: 1, username: 'lectora', email: 'l@example.com', role: { type: 'authenticated' } }).role).toBe('reader')
    expect(toPublicUser({ id: 1, username: 'lectora', email: 'l@example.com' })).toMatchObject({ role: 'reader', createdAt: null })
  })
})

describe('strapiAuthErrorCode', () => {
  it('translates the users-permissions errors', () => {
    expect(strapiAuthErrorCode(400, 'Invalid identifier or password')).toBe('invalidCredentials')
    expect(strapiAuthErrorCode(400, 'Your account has been blocked by an administrator')).toBe('invalidCredentials')
    expect(strapiAuthErrorCode(400, 'Your account email is not confirmed')).toBe('emailNotConfirmed')
    expect(strapiAuthErrorCode(400, 'Email or Username are already taken')).toBe('emailTaken')
    expect(strapiAuthErrorCode(400, 'Incorrect code provided')).toBe('invalidCode')
    expect(strapiAuthErrorCode(429, 'Too many requests, please try again later.')).toBe('tooManyRequests')
    expect(strapiAuthErrorCode(401, 'Missing or invalid credentials')).toBe('unauthorized')
    expect(strapiAuthErrorCode(400, 'Something else')).toBe('invalidInput')
    expect(strapiAuthErrorCode(500, 'Internal Server Error')).toBe('unknown')
    expect(strapiAuthErrorCode(undefined, undefined)).toBe('unknown')
  })
})

describe('authErrorCodeOf', () => {
  it('reads the code from a Nuxt error response', () => {
    expect(authErrorCodeOf({ data: { statusCode: 400, data: { code: 'wrongPassword' } } })).toBe('wrongPassword')
    expect(authErrorCodeOf({ data: { type: 'about:blank', status: 400, code: 'invalidCode', data: { code: 'wrongPassword' } } })).toBe('invalidCode')
    expect(authErrorCodeOf({ data: { code: 'tooManyRequests' } })).toBe('tooManyRequests')
    expect(authErrorCodeOf({ data: { code: 'internalError' } })).toBe('unknown')
    expect(authErrorCodeOf(new Error('network'))).toBe('unknown')
    expect(authErrorCodeOf(null)).toBe('unknown')
  })
})

describe('display helpers', () => {
  it('masks the email and takes the initial', () => {
    expect(maskEmail('lectora@correo.co')).toBe('l•••@correo.co')
    expect(maskEmail('a@correo.co')).toBe('a@correo.co')
    expect(userInitial('lectora')).toBe('L')
  })
})

describe('isEmailConfirmationToken', () => {
  it('accepts 40 lowercase hexadecimal characters only', () => {
    expect(isEmailConfirmationToken('0123456789abcdef0123456789abcdef01234567')).toBe(true)
    expect(isEmailConfirmationToken('0123456789ABCDEF0123456789abcdef01234567')).toBe(false)
    expect(isEmailConfirmationToken('0123456789abcdef0123456789abcdef0123456')).toBe(false)
    expect(isEmailConfirmationToken('0123456789abcdef0123456789abcdef012345678')).toBe(false)
    expect(isEmailConfirmationToken('g123456789abcdef0123456789abcdef01234567')).toBe(false)
    expect(isEmailConfirmationToken(undefined)).toBe(false)
  })
})
