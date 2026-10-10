interface UpstreamFetchError {
  response?: { status?: number, headers?: Headers }
  statusCode?: number
  data?: { error?: { message?: string }, message?: string }
  message?: string
}

/** Reads an unknown error as an upstream error, without checking it. A null or undefined error reads as an empty object. */
export function asUpstreamError(err: unknown): UpstreamFetchError {
  return (err ?? {}) as UpstreamFetchError
}

/** The message the CMS sent for `err`, else the error's own `message`, else `fallback`. */
export function upstreamErrorMessage(err: unknown, fallback: string): string {
  const e = asUpstreamError(err)
  return e.data?.error?.message || e.message || fallback
}
