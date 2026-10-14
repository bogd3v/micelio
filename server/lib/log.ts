import { createHmac } from 'node:crypto'
import { logText } from '../utils/upstreamError'

/** One line of the server log, before it is written (docs/security.md, "Logs"). */
export interface LogEntry {
  time: Date
  level: 'info' | 'warn' | 'error'
  /** Stable, dotted name of what happened (`cms.search`, `config.missing`), for filtering. */
  event: string
  /** Fixed text of the event; a value from the CMS or a visitor goes in `cause`, not here. */
  message: string
  /** The route pattern that served the request (`/api/posts/:slug`); absent outside a request. */
  route?: string
  /** Random id of the request, shared by every line it writes; absent outside a request. */
  requestId?: string
  /** Keyed hash of the visitor's address (`visitorHash`); absent outside a request. */
  visitor?: string
  /** What went wrong, as `upstreamLogMessage` says it, or the reason of a refusal (an error code, a rate-limit bucket, the fields a schema refused). */
  cause?: string
}

/**
 * What a log line says about an unexpected error: its name and `code`, never its message.
 *
 * @remarks
 * The message of an error from our own code or a library can hold a URL, an address or a value the visitor sent, and nothing vets it (standard, section 4). The name and the code say what kind of failure it was; Nitro's own report of the error carries the rest.
 */
export function unexpectedErrorCause(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error'
  const code = (error as { code?: unknown }).code
  return logText(typeof code === 'string' ? `${error.name} (${code})` : error.name)
}

/** Characters kept of a visitor hash: enough to tell visitors apart in a day's log, too few to look an address up. */
const VISITOR_HASH_LENGTH = 12

/**
 * A short keyed hash of a visitor's address, so a log can count and group visitors without holding an address.
 *
 * @remarks
 * HMAC-SHA256 with `key`, which the server draws at random per process: the same visitor has the same hash until a restart, and the hash cannot be reversed by trying every address without the key (standard, section 9: key by a hash when an identifier is only needed for counting).
 */
export function visitorHash(ip: string, key: Buffer | string): string {
  return createHmac('sha256', key).update(ip).digest('hex').slice(0, VISITOR_HASH_LENGTH)
}

/**
 * The JSON text of a log line: one line, with `time` (UTC, ISO 8601) first and every free text made safe with `logText`.
 *
 * @remarks
 * `JSON.stringify` already escapes line breaks; `logText` also cuts long values (ASVS V16.4.1).
 */
export function formatLogLine(entry: LogEntry): string {
  const { time, level, event, message, route, requestId, visitor, cause } = entry
  return JSON.stringify({
    time: time.toISOString(),
    level,
    event,
    message: logText(message),
    ...(route && { route: logText(route) }),
    ...(requestId && { requestId }),
    ...(visitor && { visitor }),
    ...(cause && { cause: logText(cause) }),
  })
}
