import { randomBytes, randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { formatLogLine, visitorHash } from '../lib/log'
import type { LogEntry } from '../lib/log'
import { clientIp } from './rateLimit'
import { upstreamLogMessage } from './upstreamError'

interface LogOptions {
  /** The request being served: adds the route, a request id and the hashed visitor to the line. */
  event?: H3Event
  /** A caught error: its `upstreamLogMessage` becomes the `cause`, never the error object. */
  error?: unknown
  /** The reason of a refusal, when there is no error to catch: an error code, a rate-limit bucket. A fixed word, never a visitor's value. */
  cause?: string
}

/** Per process, never leaves it: the key of the visitor hash. */
const VISITOR_KEY = randomBytes(32)

function write(level: LogEntry['level'], eventName: string, message: string, options: LogOptions): void {
  const { event, error, cause } = options
  const line = formatLogLine({
    time: new Date(),
    level,
    event: eventName,
    message,
    ...(event && requestContext(event)),
    ...(error !== undefined ? { cause: upstreamLogMessage(error) } : cause !== undefined && { cause }),
  })
  // Both methods write to standard error, whatever the level: the server writes no other sink (docs/security.md, "Logs")
  if (level === 'error') console.error(line)
  else console.warn(line)
}

function requestContext(event: H3Event): Pick<LogEntry, 'route' | 'requestId' | 'visitor'> {
  const requestId = (event.context.micelioRequestId ??= randomUUID()) as string
  const route = (event.context.matchedRoute as { path?: string } | undefined)?.path ?? event.path.split('?')[0]
  const address = clientIp(event)
  // No address: one shared hash would read as one visitor
  return { route, requestId, ...(address !== 'unknown' && { visitor: visitorHash(address, VISITOR_KEY) }) }
}

/**
 * Writes one structured error line to the server log.
 *
 * @remarks
 * `name` is a stable dotted event name and `message` fixed text. Pass the caught error as `options.error`, never in the message: only its status and CMS message are logged, with no URL (standard, section 4). With `options.event` the line also carries the route, a request id and a keyed hash of the visitor's address, never the address or an email.
 */
export function logError(name: string, message: string, options: LogOptions = {}): void {
  write('error', name, message, options)
}

/**
 * Writes one structured line for something that happened and worked, such as a sign-in; see `logError`.
 *
 * @remarks
 * The level is in the line, but it goes to standard error like the others.
 */
export function logInfo(name: string, message: string, options: LogOptions = {}): void {
  write('info', name, message, options)
}

/** Writes one structured warning line to the server log; see `logError`. */
export function logWarn(name: string, message: string, options: LogOptions = {}): void {
  write('warn', name, message, options)
}
