/** `/prefix/file.svg`: one level under the prefix, no traversal, no query, no percent-encoding */
export function isTrustedMedia(url: string | undefined, prefix: string | undefined): boolean {
  if (!url || !prefix || !prefix.startsWith('/') || !prefix.endsWith('/')) return false
  return url.startsWith(prefix) && !url.includes('..') && !url.includes('\\') && !url.includes('?') && !url.includes('%') && !url.slice(prefix.length).includes('/')
}
