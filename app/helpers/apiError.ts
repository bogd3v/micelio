interface ApiError {
  response?: { status?: number }
  statusCode?: number
  data?: { code?: unknown, data?: { code?: unknown } }
}

// Every field may be missing: `null` and `undefined` become an empty object

function asApiError(err: unknown): ApiError {
  return (err ?? {}) as ApiError
}

/**
 * The machine `code` of the problem detail an `/api/*` route answered, or `undefined` when the error carries none.
 *
 * @remarks
 * It reads `code` of the response body (`application/problem+json`, ADR 0015) and falls back to `data.code`, which every error repeats for one release line. A network failure has no body, so the code is `undefined` and the caller falls back to the status.
 */
export function problemCodeOf(err: unknown): string | undefined {
  const data = asApiError(err).data
  return [data?.code, data?.data?.code].find((code): code is string => typeof code === 'string')
}

/** The HTTP status of a caught error, from the response or from the Nitro `statusCode`, or `undefined` for a failure with no response. */
export function statusOf(err: unknown): number | undefined {
  const e = asApiError(err)
  return e.response?.status || e.statusCode || undefined
}
