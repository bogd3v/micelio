import { THEME_ID, THEME_VERSION, VERSION_MAX_LENGTH } from '../constants'
import { THEME_DIGEST } from './constants'
import { RegistryError } from './error'
import type { ThemePin } from './types'

// The grammar of a pin is checked before any request is made or any path is built from it (ADR 0009, section 2).

/**
 * Why `pin` is not a valid pin, or `null` when it is: an id, an exact semver version and a `sha256:` digest.
 *
 * @param pin - Anything: the value comes from a lock, a CLI argument or the site settings.
 */
export function pinProblem(pin: unknown): string | null {
  const value = typeof pin === 'object' && pin !== null ? pin as Record<string, unknown> : {}
  if (typeof value.id !== 'string' || !THEME_ID.test(value.id)) return 'the theme id is not lowercase letters and digits in groups separated by single hyphens, 1 to 64 characters'
  if (typeof value.version !== 'string' || value.version.length > VERSION_MAX_LENGTH || !THEME_VERSION.test(value.version)) return 'the version is not an exact semantic version without build metadata (1.2.3 or 1.2.3-rc.1)'
  if (typeof value.digest !== 'string' || !THEME_DIGEST.test(value.digest)) return 'the digest is not sha256: followed by 64 lowercase hex digits'
  return null
}

/**
 * Returns `pin` typed, or throws.
 *
 * @throws `RegistryError` (`pin`) naming the first rule the pin breaks; it never echoes the invalid value.
 */
export function assertPin(pin: unknown): ThemePin {
  const problem = pinProblem(pin)
  if (problem !== null) throw new RegistryError('pin', `invalid pin: ${problem}`)
  const { id, version, digest } = pin as ThemePin
  return { id, version, digest }
}
