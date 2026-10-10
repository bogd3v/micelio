/**
 * The role of a signed-in account: `editor` may open the drafts, `reader` may not.
 *
 * @public
 */
export type AuthRole = 'reader' | 'editor'

/**
 * A signed-in account as the frontend shows it, built from a Strapi user by `app/helpers/auth.ts`.
 *
 * @public
 */
export interface AuthUser {
  username: string
  /** The address the account signed up with. */
  email: string
  role: AuthRole
  /** ISO 8601 date the account was created; null when Strapi did not return one. */
  createdAt: string | null
}

/**
 * The answer to the session check: the signed-in account, or null when the visitor is signed out.
 *
 * @public
 */
export interface AuthUserResponse {
  user: AuthUser | null
}

/**
 * The error codes of the auth routes. `app/helpers/auth.ts` maps Strapi's messages to these codes, and the forms turn each code into a translated message.
 *
 * @public
 */
export type AuthErrorCode
  = | 'invalidCredentials'
    | 'emailNotConfirmed'
    | 'emailTaken'
    | 'tooManyRequests'
    | 'invalidCode'
    | 'wrongPassword'
    | 'invalidInput'
    | 'unauthorized'
    | 'forbiddenOrigin'
    | 'unknown'

/**
 * A notice the sign-in page shows, passed in its `notice` query parameter.
 *
 * @public
 */
export type AuthNotice = 'signed-out' | 'account-deleted' | 'password-reset'

/**
 * How strong a password is, from 0 (empty) to 4 (18 characters or more, or 14 with whitespace); the rules are in `passwordStrength`.
 *
 * @public
 */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4

/**
 * The fields of the sign-in form.
 *
 * @public
 */
export interface LoginInput {
  /** The username or the email address. */
  identifier: string
  password: string
}

/**
 * The fields of the sign-up form.
 *
 * @public
 */
export interface RegisterInput {
  username: string
  email: string
  password: string
  /** The visitor accepted the privacy notice; the server accepts only `true`. */
  acceptPrivacy: boolean
}

/**
 * The fields of the password reset form, after the code arrives by email.
 *
 * @public
 */
export interface ResetPasswordInput {
  /** The code sent by email. */
  code: string
  password: string
  /** The new password typed a second time. */
  passwordConfirmation: string
}

/**
 * The fields that confirm an account deletion.
 *
 * @public
 */
export interface DeleteAccountInput {
  username: string
  password: string
}

/**
 * A user of Strapi's users-permissions plugin, as the auth routes receive it.
 *
 * @public
 */
export interface StrapiAuthUser {
  id: number
  username: string
  email: string
  /** Whether the email address was confirmed. */
  confirmed?: boolean
  /** Set by an administrator; a blocked account cannot sign in. */
  blocked?: boolean
  createdAt?: string
  role?: { type?: string | null } | null
}
