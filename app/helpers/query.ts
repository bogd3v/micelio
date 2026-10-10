type QueryValue = string | number | boolean | null | undefined

/**
 * Serializes parameters to a query string, without the leading `?`.
 *
 * @remarks
 * `undefined` and `null` values are left out; other values are converted with `String()`.
 */
export function toQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    search.append(key, String(value))
  }
  return search.toString()
}
