// Source offer of AGPL section 13 (docs/adr/0007-license.md, section 2).
/** The upstream repository, the source that `resolveSourceUrl()` falls back to. */
export const UPSTREAM_SOURCE_URL = 'https://github.com/bogd3v/micelio'

/** The configured source URL when it is an http(s) URL, otherwise upstream. */
export function resolveSourceUrl(configured: string | undefined): string {
  return configured && /^https?:\/\/\S+$/i.test(configured) ? configured : UPSTREAM_SOURCE_URL
}
