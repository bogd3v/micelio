import { DEFAULT_REGISTRY, DEFAULT_SIGNER } from './constants'
import { RegistryError } from './error'
import type { SignerIdentity } from './types'

// Which signer a registry's attestations must come from (ADR 0009, section 3). The default registry has a constant of the core; any
// other registry needs the operator to say, or nothing is installed from it.

const URL_VALUE = /^https:\/\/[\x21-\x7E]{1,500}$/
const KEYS = new Set(['issuer', 'package', 'index'])

/**
 * Parses `MICELIO_THEME_REGISTRY_IDENTITY`: `issuer=<https URL>,package=<https URL>[,index=<https URL>]`.
 *
 * @remarks
 * `package` and `index` are the exact subject alternative names of the workflows that sign packages and the index; `index` defaults
 * to `package`. They are matched whole, never as a pattern.
 *
 * @throws `RegistryError` (`signer`) when the text is not of that shape.
 */
export function parseIdentity(text: string): SignerIdentity {
  const values = new Map<string, string>()
  for (const part of text.split(',')) {
    const at = part.indexOf('=')
    const key = part.slice(0, at).trim()
    const value = part.slice(at + 1).trim()
    if (at < 1 || !KEYS.has(key) || !URL_VALUE.test(value) || values.has(key)) {
      throw new RegistryError('signer', 'MICELIO_THEME_REGISTRY_IDENTITY must be issuer=<https URL>,package=<https URL>[,index=<https URL>], each key once')
    }
    values.set(key, value)
  }
  const issuer = values.get('issuer')
  const packages = values.get('package')
  if (!issuer || !packages) throw new RegistryError('signer', 'MICELIO_THEME_REGISTRY_IDENTITY needs issuer= and package=')
  return { issuer, packages, index: values.get('index') ?? packages }
}

/**
 * The identity to verify `registry` against, or `null` when none is known.
 *
 * @remarks
 * The default registry uses the identity built into the core. Any other registry uses `MICELIO_THEME_REGISTRY_IDENTITY`, and only
 * when it is the registry `MICELIO_THEME_REGISTRY` names: a lock entry resolved against some third registry has no known signer.
 *
 * @throws `RegistryError` (`signer`) when `MICELIO_THEME_REGISTRY_IDENTITY` is set and invalid.
 */
export function identityFor(registry: string, env: NodeJS.ProcessEnv = process.env): SignerIdentity | null {
  if (registry === DEFAULT_REGISTRY) return { ...DEFAULT_SIGNER }
  if (registry === env.MICELIO_THEME_REGISTRY && env.MICELIO_THEME_REGISTRY_IDENTITY) return parseIdentity(env.MICELIO_THEME_REGISTRY_IDENTITY)
  return null
}
