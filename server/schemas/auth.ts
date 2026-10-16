import { z } from 'zod'
import { isEmailConfirmationToken, isValidEmail, isValidPassword, isValidUsername } from '~/helpers/auth'

// Upper bounds, so a body cannot make the server hold or hash something huge: an email address is at most 254 characters (RFC 5321),
// a password typed into a form at most 1024, and a reset code is made of the characters the CMS uses
const MAX_EMAIL_LENGTH = 254
const MAX_TYPED_PASSWORD_LENGTH = 1024
const email = z.string().trim().toLowerCase().max(MAX_EMAIL_LENGTH).refine(isValidEmail)
const password = z.string().refine(isValidPassword)
const typedPassword = z.string().min(1).max(MAX_TYPED_PASSWORD_LENGTH)
const resetCode = z.string().regex(/^[\w-]{1,256}$/)

/**
 * The body of `POST /api/auth/login`: an `identifier` (a username or an email, as the CMS takes it) and a password, both non-empty.
 *
 * @remarks
 * The CMS decides whether the pair is valid. The password is neither trimmed nor length-checked here.
 */
export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(MAX_EMAIL_LENGTH),
  password: typedPassword,
})

/** The body of `POST /api/auth/register`. The username must pass `isValidUsername`, the email is trimmed, lowercased and must have a valid shape, and the password must be at least ten characters. `acceptPrivacy` must be the literal `true`. */
export const registerSchema = z.object({
  username: z.string().trim().refine(isValidUsername),
  email,
  password,
  acceptPrivacy: z.literal(true),
})

/** The body of the routes that take only an address: `POST /api/auth/forgot-password` and `POST /api/auth/resend-confirmation`. The address is trimmed, lowercased and checked for a valid shape. */
export const emailSchema = z.object({ email })

/** The body of `POST /api/auth/reset-password`: the code from the email, a new password of at least ten characters and at most 72 bytes, and its repetition, which must equal it. The code is at most 256 letters, digits, underscores or hyphens. */
export const resetPasswordSchema = z.object({
  code: resetCode,
  password,
  passwordConfirmation: z.string(),
}).refine(input => input.password === input.passwordConfirmation)

/**
 * The body of `POST /api/auth/change-password`: the current password, a new one of at least ten characters, and its repetition.
 *
 * @remarks
 * The current password must be non-empty and the CMS checks it. The repetition must equal the new password, and the new password must differ from the current one.
 */
export const changePasswordSchema = z.object({
  currentPassword: typedPassword,
  password,
  passwordConfirmation: z.string(),
}).refine(input => input.password === input.passwordConfirmation).refine(input => input.password !== input.currentPassword)

/** The body of `DELETE /api/auth/me`: the username and the password that confirm the deletion. Both must be non-empty; the CMS checks them. */
export const deleteAccountSchema = z.object({
  username: z.string().min(1).max(MAX_EMAIL_LENGTH),
  password: typedPassword,
})

/** The body of `POST /api/auth/confirm-email`: the confirmation token of the email link, 40 lowercase hexadecimal characters. The CMS decides whether it exists and is unused. */
export const confirmEmailSchema = z.object({
  confirmation: z.string().refine(isEmailConfirmationToken),
})
