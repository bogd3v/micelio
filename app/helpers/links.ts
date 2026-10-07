export interface ResolvedLink {
  href: string
  external: boolean
}

const EXTERNAL = /^(https?:|mailto:)/i

export function resolveLink(url: string, localize: (path: string) => string): ResolvedLink {
  const trimmed = url.trim()
  if (EXTERNAL.test(trimmed)) return { href: trimmed, external: true }
  if (trimmed.startsWith('/')) return { href: localize(trimmed), external: false }
  return { href: trimmed, external: false }
}

/**
 * Link of a page section (the CMS does not localize site paths, so a path that already carries the
 * locale prefix is kept). Only http(s), mailto: and site paths pass, without control characters or
 * whitespace inside; everything else (`//host`, `/\host`, `javascript:`) gives null.
 */
export function resolveSectionLink(url: string, prefix: string, localize: (path: string) => string): ResolvedLink | null {
  // eslint-disable-next-line no-control-regex -- control characters are what this rejects
  const trimmed = url.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '')
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x20\x7f]/.test(trimmed)) return null
  if (!/^(?:https?:\/\/|mailto:|\/(?![/\\]))/i.test(trimmed)) return null
  const prefixed = prefix !== '' && (trimmed === prefix || ['/', '?', '#'].some(sep => trimmed.startsWith(prefix + sep)))
  return resolveLink(trimmed, prefixed ? path => path : localize)
}
