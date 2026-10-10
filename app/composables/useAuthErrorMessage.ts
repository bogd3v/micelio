import type { AuthErrorCode } from '~/interfaces'
import { authErrorCodeOf } from '~/helpers/auth'

const MESSAGE_CODES: readonly AuthErrorCode[] = [
  'invalidCredentials',
  'emailNotConfirmed',
  'emailTaken',
  'tooManyRequests',
  'invalidCode',
  'wrongPassword',
]

/**
 * Returns a function that turns an auth error into a translated message.
 *
 * @remarks
 * A known error code maps to `account.errors.<code>`; any other error maps to `account.errors.unknown`. Call it in setup, because it reads `useI18n`.
 */
export function useAuthErrorMessage(): (err: unknown) => string {
  const { t } = useI18n()

  return function errorMessage(err: unknown): string {
    const code = authErrorCodeOf(err)
    return t(`account.errors.${MESSAGE_CODES.includes(code) ? code : 'unknown'}`)
  }
}
