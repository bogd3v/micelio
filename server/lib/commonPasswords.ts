import { COMMON_PASSWORDS } from './commonPasswords.data'

let common: Set<string> | undefined

/**
 * Whether a password is one of the 3000 most common ones that meet the password policy, ignoring case.
 *
 * @remarks
 * The list is `commonPasswords.data.ts`, from SecLists (ASVS V6.2.4). Only an exact match counts: a listed password inside a longer one is a different password. The set is built on the first call.
 */
export function isCommonPassword(password: string): boolean {
  common ??= new Set(COMMON_PASSWORDS.split('\n'))
  return common.has(password.toLowerCase())
}
