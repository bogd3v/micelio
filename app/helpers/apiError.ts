interface ApiError {
  response?: { status?: number }
  statusCode?: number
  data?: { message?: string }
  message?: string
}

/**
 * Reads a caught error as an `ApiError` without checking its shape.
 *
 * @remarks
 * Every field may be missing. `null` and `undefined` become an empty object.
 */
export function asApiError(err: unknown): ApiError {
  return (err ?? {}) as ApiError
}
