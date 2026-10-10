interface ApiError {
  response?: { status?: number }
  statusCode?: number
  data?: { message?: string }
  message?: string
}

export function asApiError(err: unknown): ApiError {
  return (err ?? {}) as ApiError
}
