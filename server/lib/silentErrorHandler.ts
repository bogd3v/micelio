import { send, setResponseHeaders, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'

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

/**
 * Wraps an error handler so the default handler never writes its own `[request error]` report, neither when the handler calls it nor when it leaves the error unanswered (a JSON request) and Nitro's fallback would.
 *
 * @remarks
 * That report is free text over several lines and holds the URL with its query (ASVS V16.2.4). `server/plugins/errorLog.ts` writes the structured `server.unhandled` record for the same error.
 */
export function silenceDefaultReport(handler: NitroErrorHandler): NitroErrorHandler {
  return async (error, event, { defaultHandler }) => {
    const silent: NitroErrorHandlerContext['defaultHandler'] = (e, ev, opts) => defaultHandler(e, ev, { ...opts, silent: true })
    await handler(error, event, { defaultHandler: silent })
    if (event.handled) return
    // The answer Nitro's fallback handler would give, written here so its report is not
    const res = await silent(error, event)
    setResponseHeaders(event, res.headers)
    setResponseStatus(event, res.status, res.statusText)
    return send(event, JSON.stringify(res.body, null, 2))
  }
}
