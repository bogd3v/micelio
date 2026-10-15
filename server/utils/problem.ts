import type { H3Error } from 'h3'
import type { AuthErrorCode } from '~/interfaces/auth'

/** A stable, machine-readable error code: the auth codes plus the general ones every route can answer. */
export type ProblemCode
  = | AuthErrorCode
    | 'notFound'
    | 'methodNotAllowed'
    | 'payloadTooLarge'
    | 'invalidRequest'
    | 'invalidToken'
    | 'upstreamUnavailable'
    | 'internalError'
    | 'requestRejected'

/** What the catalog says about one code: the HTTP status, its phrase and a fixed developer-facing explanation. */
interface ProblemEntry {
  status: number
  /** The status phrase (RFC 9110), the same for every error of that status. */
  title: string
  /** Fixed English text for developers. Never a CMS message, a URL or a stack. */
  detail: string
}

/** The members of an RFC 9457 problem detail as Micelio sends them, plus the Nitro members clients already read. */
interface ProblemBody {
  type: 'about:blank'
  title: string
  status: number
  detail: string
  code: ProblemCode
  statusCode: number
  statusMessage: string
  message: string
  data?: unknown
}

/** Options of `problem`. */
interface ProblemOptions {
  /** Replaces the catalog `detail`. It must be a fixed English literal chosen by the caller: never an upstream message, a URL or user input. */
  detail?: string
  /**
   * Legacy: the `message` member Nitro clients read. Defaults to `statusMessage`.
   *
   * @remarks
   * Fixed text chosen by the route, never upstream text. Removed with the other legacy members after one release line (ADR 0015).
   */
  message?: string
  /**
   * Legacy: the HTTP status text, and `statusMessage` of the body. Defaults to the catalog `title`; auth errors pass the code (`authFailure`).
   *
   * @remarks
   * Fixed text, or the message of a zod issue. Removed with the other legacy members after one release line (ADR 0015).
   */
  statusMessage?: string
  /** Extra members merged into `data` next to `code`. They are sent to the client as is, so they must hold nothing private. */
  data?: Record<string, unknown>
}

const BAD_REQUEST = 'Bad Request'
const FORBIDDEN = 'Forbidden'

/**
 * Every error code Micelio answers, with its status, status phrase and developer detail.
 *
 * @remarks
 * Consumed by the OpenAPI document of #441.
 *
 * The key is the `code` extension member of the problem detail (and, for auth errors, the legacy `statusMessage`), so a client branches on it and never on text.
 */
export const PROBLEM_CODES: Record<ProblemCode, ProblemEntry> = {
  invalidCredentials: { status: 400, title: BAD_REQUEST, detail: 'The identifier or the password is wrong.' },
  emailNotConfirmed: { status: 400, title: BAD_REQUEST, detail: 'The account email address has not been confirmed.' },
  emailTaken: { status: 409, title: 'Conflict', detail: 'An account with this email address or username already exists.' },
  tooManyRequests: { status: 429, title: 'Too Many Requests', detail: 'Too many requests. Wait for the time in the Retry-After header, if present, before trying again.' },
  invalidCode: { status: 400, title: BAD_REQUEST, detail: 'The code is invalid or has expired.' },
  wrongPassword: { status: 400, title: BAD_REQUEST, detail: 'The current password is wrong.' },
  weakPassword: { status: 400, title: BAD_REQUEST, detail: 'The password does not meet the strength rules.' },
  commonPassword: { status: 400, title: BAD_REQUEST, detail: 'The password is too common.' },
  invalidInput: { status: 400, title: BAD_REQUEST, detail: 'The request body does not meet the schema of the route.' },
  unauthorized: { status: 401, title: 'Unauthorized', detail: 'A valid session is required.' },
  forbiddenOrigin: { status: 403, title: FORBIDDEN, detail: 'The request does not come from the site origin.' },
  unknown: { status: 502, title: 'Bad Gateway', detail: 'The content service failed or answered with something unexpected.' },
  notFound: { status: 404, title: 'Not Found', detail: 'The resource does not exist.' },
  methodNotAllowed: { status: 405, title: 'Method Not Allowed', detail: 'The route does not accept this HTTP method.' },
  payloadTooLarge: { status: 413, title: 'Content Too Large', detail: 'The request body is larger than the route accepts.' },
  invalidRequest: { status: 400, title: BAD_REQUEST, detail: 'The request is malformed or a parameter is invalid.' },
  upstreamUnavailable: { status: 502, title: 'Bad Gateway', detail: 'The content service failed or is unreachable.' },
  internalError: { status: 500, title: 'Internal Server Error', detail: 'The server failed to handle the request.' },
  invalidToken: { status: 400, title: BAD_REQUEST, detail: 'The token is missing or malformed.' },
  requestRejected: { status: 400, title: BAD_REQUEST, detail: 'The server refused the request.' },
}

/** Status phrases of RFC 9110, for statuses no catalog entry covers. */
const STATUS_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Content Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: 'I\'m a Teapot',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

/** Codes a status falls back to when an error carries no known `data.code`. */
const STATUS_CODES: Record<number, ProblemCode> = {
  400: 'invalidRequest',
  401: 'unauthorized',
  404: 'notFound',
  405: 'methodNotAllowed',
  413: 'payloadTooLarge',
  429: 'tooManyRequests',
  502: 'upstreamUnavailable',
}

/** Property that carries the caller's `detail` on the error until `problemFromError` reads it. */
const DETAIL_KEY = 'problemDetail'

/**
 * Builds the error of a failed request for `code`, and returns it so the caller throws it.
 *
 * @remarks
 * The status comes from the catalog (`PROBLEM_CODES`) and `data` is `{ code, ...data }`. `statusMessage` is the catalog `title` unless `options` overrides it (auth errors pass the code), and `message` follows it unless overridden: the text each route always sent, so clients that read it keep working. `server/plugins/problemDetails.ts` turns it into an `application/problem+json` response for `/api/*`.
 *
 * @param code - The catalog code.
 * @param options - A fixed developer `detail`, the legacy `message` and `statusMessage`, and extra `data` members.
 *
 * @example
 * ```ts
 * throw problem('notFound')
 * ```
 */
export function problem(code: ProblemCode, options: ProblemOptions = {}): ReturnType<typeof createError> {
  const entry = PROBLEM_CODES[code]
  const error = createError({
    statusCode: entry.status,
    statusMessage: options.statusMessage ?? entry.title,
    ...(options.message ? { message: options.message } : {}),
    data: { ...options.data, code },
  })
  if (options.detail) Object.assign(error, { [DETAIL_KEY]: options.detail })
  return error
}

/**
 * The problem detail body for any error that reached the error handler.
 *
 * @remarks
 * `code` is `data.code` when it is in the catalog, else derived from the status (`requestRejected` for an unmapped 4xx, `internalError` for a 5xx; an unhandled or fatal error is always a 500 `internalError`). `detail` is the catalog text or the one given to `problem`; it is never `error.message`, which can hold CMS text or user input. `message` and `data` are the Nitro members and are dropped for unhandled errors.
 *
 * @param error - The error H3 handed to the error handler.
 */
export function problemFromError(error: H3Error): ProblemBody {
  const dataCode = (error.data as { code?: unknown } | undefined)?.code
  const known = typeof dataCode === 'string' && Object.hasOwn(PROBLEM_CODES, dataCode) ? dataCode as ProblemCode : undefined
  const isUnhandled = Boolean(error.unhandled || error.fatal)
  // An unhandled error is a 500 whatever status it carries, so a raw upstream failure never shows the CMS status
  const status = !isUnhandled && error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 500
  const code: ProblemCode = isUnhandled ? 'internalError' : (known ?? STATUS_CODES[status] ?? (status >= 500 ? 'internalError' : 'requestRejected'))
  const entry = PROBLEM_CODES[code]
  const callerDetail = (error as unknown as Record<string, unknown>)[DETAIL_KEY]
  return {
    type: 'about:blank',
    // The status phrase of the real status, which differs from the catalog's only for a code thrown with another status
    title: status === entry.status ? entry.title : (STATUS_PHRASES[status] ?? entry.title),
    status,
    detail: typeof callerDetail === 'string' ? callerDetail : entry.detail,
    code,
    statusCode: status,
    statusMessage: isUnhandled ? entry.title : (error.statusMessage || entry.title),
    message: isUnhandled ? 'Server Error' : (error.message || entry.title),
    data: isUnhandled ? undefined : error.data,
  }
}
