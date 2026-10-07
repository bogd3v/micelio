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
 * Link of a page section: the CMS does not localize site paths, so a path that already carries
 * the locale prefix is kept. Returns null for what must not be linked (`//host`, `/\host`, other schemes).
 */
export function resolveSectionLink(url: string, prefix: string, localize: (path: string) => string): ResolvedLink | null {
  const trimmed = url.trim()
  if (/^\/[/\\]/.test(trimmed)) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !EXTERNAL.test(trimmed)) return null
  const prefixed = prefix !== '' && (trimmed === prefix || ['/', '?', '#'].some(sep => trimmed.startsWith(prefix + sep)))
  return resolveLink(trimmed, prefixed ? path => path : localize)
}
