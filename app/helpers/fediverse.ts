import type { InstanceResult } from '../interfaces/design'

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i
const ACCOUNT_PREFIX = /^@?[^@\s/]+@/
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

/**
 * Turns what a reader typed into the host of a fediverse instance.
 *
 * @remarks
 * Accepts a URL, a host or an account (`@user@host`). The scheme, the account, any path, query or hash, a trailing dot and a port
 * are dropped. Answers `{ error: 'empty' }` for blank input and `{ error: 'invalid' }` when the rest is not a host with at least
 * two labels whose last label is not all digits (an IPv4 address is refused).
 */
export function normalizeInstance(input: string): InstanceResult {
  let value = input.trim().toLowerCase()
  if (!value) return { error: 'empty' }
  value = value.replace(SCHEME, '').replace(ACCOUNT_PREFIX, '')
  value = value.split(/[/?#]/)[0]!.replace(/\.$/, '')
  if (/\s/.test(value) || value.includes('@')) return { error: 'invalid' }

  let hostname: string
  try {
    hostname = new URL(`https://${value}`).hostname
  } catch {
    return { error: 'invalid' }
  }

  const labels = hostname.split('.')
  if (labels.length < 2 || !labels.every(label => LABEL.test(label)) || /^\d+$/.test(labels.at(-1)!)) {
    return { error: 'invalid' }
  }
  return { domain: hostname }
}

/** The instance's own follow page for an actor, with the actor's URL in `uri`. */
export function followUrl(domain: string, actorUrl: string): string {
  return `https://${domain}/authorize_interaction?uri=${encodeURIComponent(actorUrl)}`
}
