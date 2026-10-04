/**
 * Builds a canonical URL for the given route path.
 * Combines `useSiteUrl()` base with the locale-prefixed path from `useLocaleUtils()`.
 *
 * @example
 * ```ts
 * const { canonicalUrl } = useCanonicalUrl('/blog')
 * // siteUrl = "https://example.org", localizePath('/blog') = "/blog"
 * // canonicalUrl = "https://example.org/blog"
 * ```
 */
export function useCanonicalUrl(path: string) {
  const { siteUrl } = useSiteUrl()
  const { localizePath } = useLocaleUtils()

  const canonicalUrl = computed(() => `${siteUrl.value}${localizePath(path)}`)

  return { canonicalUrl }
}
