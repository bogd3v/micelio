import { send, setResponseHeaders, setResponseStatus } from 'h3'

/** Headers the default Nitro error response carries, kept so an error never becomes a script or a frame. */
const PROBLEM_HEADERS: Record<string, string> = {
  'content-type': 'application/problem+json',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': 'script-src \'none\'; frame-ancestors \'none\';',
}

/**
 * Answers every error of an `/api/*` route as an RFC 9457 problem detail (`application/problem+json`, ADR 0015).
 *
 * @remarks
 * Nuxt 4 has no `render:error` hook, so this wraps the `onError` of the H3 app: the error is captured as Nitro does (`errorLog.ts` still logs it), then the response is written here. Pages keep the Nuxt error page. Headers the route already set, like `Retry-After`, stay.
 */
export default defineNitroPlugin((nitroApp) => {
  const original = nitroApp.h3App.options.onError
  nitroApp.h3App.options.onError = async (error, event) => {
    if (!event.path.startsWith('/api/') || event.handled) return original?.(error, event)
    nitroApp.captureError(error, { event, tags: ['request'] })
    const body = problemFromError(error)
    // A 5xx is never stored, whatever the route set; otherwise Nitro's rule: keep the route's header, but never cache a 404
    const noCache = body.status >= 500 ? 'no-store' : (body.status === 404 || !event.node.res.hasHeader('cache-control')) ? 'no-cache' : undefined
    // A non-root `app.baseURL` is not handled here: the path check and Nitro's baseURL redirect assume the root
    setResponseHeaders(event, { ...PROBLEM_HEADERS, ...(noCache ? { 'cache-control': noCache } : {}) })
    setResponseStatus(event, body.status, body.statusMessage)
    return send(event, JSON.stringify(body))
  }
})
