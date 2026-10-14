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

const MAX_LOG_LENGTH = 300

/**
 * A text made safe for one log line: control characters become spaces and the text is cut at 300 characters.
 *
 * @remarks
 * Use it for any value that comes from the CMS or from a visitor and is written into a log message, so that a line break in it cannot start a forged line (ASVS V16.4.1).
 */
export function logText(text: string): string {
  // eslint-disable-next-line no-control-regex -- control characters are what a forged log line is made of
  const clean = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
  return clean.length > MAX_LOG_LENGTH ? `${clean.slice(0, MAX_LOG_LENGTH)}…` : clean
}

/**
 * What a log line says about an error: for an upstream error the status and the message the CMS sent, never the request URL or its query.
 *
 * @remarks
 * The message of a failed request holds the URL, and the URL of a lookup holds a reader's email address or a token (standard, section 4: no personal data in logs). An error of our own code keeps its name and message, unless it has a `code` (a mail or network error): then only the name and the code, because its message can hold the address it failed on. Line breaks and other control characters become spaces, so a value from the CMS cannot start a forged line, and the text is cut at 300 characters.
 */
export function upstreamLogMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'unknown error'
  const e = asUpstreamError(err)
  const named = (err as { name?: unknown }).name
  if (named !== 'FetchError' && e.statusCode === undefined && !e.response) {
    if (!(err instanceof Error)) return 'unknown error'
    // A mail or network error carries a `code` and a message that can hold the address it failed on: say the code only
    const code = (err as { code?: unknown }).code
    return typeof code === 'string' ? logText(`${err.name} (${code})`) : logText(`${err.name}: ${err.message}`)
  }
  const status = e.response?.status ?? e.statusCode
  const cms = e.data?.error?.message || e.data?.message
  const head = status ? `upstream ${status}` : 'upstream, no response'
  return cms ? logText(`${head}: ${cms}`) : head
}
