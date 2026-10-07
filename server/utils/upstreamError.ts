interface UpstreamFetchError {
  response?: { status?: number, headers?: Headers }
  statusCode?: number
  data?: { error?: { message?: string }, message?: string }
  message?: string
}

export function asUpstreamError(err: unknown): UpstreamFetchError {
  return (err ?? {}) as UpstreamFetchError
}

export function upstreamErrorMessage(err: unknown, fallback: string): string {
  const e = asUpstreamError(err)
  return e.data?.error?.message || e.message || fallback
}
