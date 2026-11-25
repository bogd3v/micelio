import { send, setResponseHeaders, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import { parseQuery, stringifyQuery } from 'vue-router'

/** What Nitro's default handler answers: the response to write. */
interface DefaultResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: unknown
}

/** The default Nitro handler and the options the error handlers receive. */
export interface NitroErrorHandlerContext {
  defaultHandler: (error: unknown, event: H3Event, opts?: { silent?: boolean, json?: boolean }) => DefaultResponse | Promise<DefaultResponse>
}

/** An error handler as Nitro calls it. */
export type NitroErrorHandler = (error: unknown, event: H3Event, context: NitroErrorHandlerContext) => unknown

/** The ways an error can spell the query of the request: as sent, decoded, and as the router writes it in a `fullPath`. Empty when it has none. */
function queryForms(event: H3Event): string[] {
  const at = event.path.indexOf('?')
  const search = at === -1 ? '' : event.path.slice(at)
  if (search.length < 2) return []
  const forms = new Set([search, `?${stringifyQuery(parseQuery(search.slice(1)))}`])
  try {
    forms.add(decodeURIComponent(search))
  } catch {
    // A malformed escape has no decoded form
  }
  return [...forms].filter(form => form.length > 1).sort((a, b) => b.length - a.length)
}

/** A copy of `value` whose strings, in plain objects and arrays at any depth, no longer hold any of `forms`. */
function scrub(value: unknown, forms: string[], seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return forms.reduce((text, form) => text.replaceAll(form, ''), value)
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) return value.map(item => scrub(item, forms, seen))
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item, forms, seen)]))
}

/** Removes `forms` from the members of the error that the handlers write into an answer: `message`, `statusMessage`, `statusText` and `data`. */
function scrubError(error: unknown, forms: string[]): void {
  if (!error || typeof error !== 'object') return
  const members = error as Record<string, unknown>
  for (const key of ['message', 'statusMessage', 'statusText', 'data']) {
    if (members[key] === undefined) continue
    try {
      members[key] = scrub(members[key], forms)
    } catch {
      // A member that cannot be written keeps its value
    }
  }
}

/**
 * The answer with its `url` member, when it has one, cut to the address without its query string, and with `forms` removed from its status text and from every string of its body.
 *
 * @remarks
 * Nitro's default handler writes `getRequestURL(event).href` there, and Nuxt's handler renders the error page from it.
 */
function withoutQuery(res: DefaultResponse, forms: string[]): DefaultResponse {
  const body = scrub(res.body, forms)
  const statusText = scrub(res.statusText, forms) as string
  if (!body || typeof body !== 'object' || !('url' in body) || typeof body.url !== 'string' || !URL.canParse(body.url)) return { ...res, statusText, body }
  const url = new URL(body.url)
  url.search = ''
  url.hash = ''
  return { ...res, statusText, body: { ...body, url: url.href } }
}

/**
 * Wraps an error handler so the default handler never writes its own `[request error]` report, neither when the handler calls it nor when it leaves the error unanswered (a JSON request) and Nitro's fallback would, and so no error answer holds the query of the address.
 *
 * @remarks
 * That report is free text over several lines and holds the URL with its query (ASVS V16.2.4). `server/plugins/errorLog.ts` writes the structured `server.unhandled` record for the same error.
 *
 * Some addresses carry a secret in their query (the token of `/_preview`, a password-reset code, a newsletter token; `docs/security.md`), and a token appears in no problem detail or message (ADR 0019, section 3). So the query of the request is removed from the error before the wrapped handler reads it (`message`, `statusMessage`, `statusText`, `data`: the router's 404 names the path with its query), and the default handler's answer, the one the wrapped handler receives and the fallback writes, keeps the address without its query string and no copy of the query in its status text or body. Nuxt's handler renders the error page from that answer, so the page holds no query either.
 */
export function silenceDefaultReport(handler: NitroErrorHandler): NitroErrorHandler {
  return async (error, event, { defaultHandler }) => {
    const forms = queryForms(event)
    scrubError(error, forms)
    const silent: NitroErrorHandlerContext['defaultHandler'] = async (e, ev, opts) => withoutQuery(await defaultHandler(e, ev, { ...opts, silent: true }), forms)
    await handler(error, event, { defaultHandler: silent })
    if (event.handled) return
    // The answer Nitro's fallback handler would give, written here so its report is not
    const res = await silent(error, event)
    setResponseHeaders(event, res.headers)
    setResponseStatus(event, res.status, res.statusText)
    return send(event, JSON.stringify(res.body, null, 2))
  }
}
