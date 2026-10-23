import type { H3Event } from 'h3'
import { STATIC_CSP } from '~/constants/security'
import { defaultLocale } from '~/interfaces/locale'
import { ipBucket } from '../../lib/clientIp'
import { forwardWebFinger } from '../../lib/webfinger'

// A remote server waits for the lookup, so a stalled CMS answers 504 well before the remote gives up
const WEBFINGER_TIMEOUT_MS = 5000
// A JRD is a few hundred bytes; anything near this cap is not one
const MAX_BODY_BYTES = 64 * 1024
// Longer than any acct: or https: resource the CMS serves; refused here instead of sent on
const MAX_RESOURCE_LENGTH = 1024
// A found handle changes only when the editor renames the account, so a few minutes is enough
const FOUND_CACHE = 'public, max-age=300'
// What a WebFinger answer is; any other type the CMS sends goes out as opaque bytes
const PASSED_TYPES = ['application/jrd+json', 'application/json', 'text/plain']
const MAX_RETRY_AFTER_SECONDS = 3600

/** WebFinger (RFC 7033) on the site domain: the CMS's answer for `resource`, so the handle `@user@<site host>` resolves without a proxy rule (docs/api.md). */
export default defineEventHandler(async (event) => {
  if (!(await loadSiteCached(defaultLocale)).site.modules.fediverse) return empty(event, 404, 'no-cache')
  const query = getQuery(event).resource
  // A repeated parameter arrives as an array; the first value is the one a WebFinger server reads
  const resource = Array.isArray(query) ? query[0] : query
  if (typeof resource === 'string' && resource.length > MAX_RESOURCE_LENGTH) return empty(event, 400, 'no-cache')
  try {
    assertRateLimit(event, 'webfingerPerIp', ipBucket(clientIp(event)))
    assertRateLimit(event, 'webfingerGlobal', 'all')
  } catch {
    // assertRateLimit set Retry-After and logged the hit; a WebFinger client expects a bare status, not a problem document
    return empty(event, 429, 'no-store')
  }
  const answer = await forwardWebFinger(strapiUrl('/.well-known/webfinger'), typeof resource === 'string' ? resource : undefined, { timeoutMs: WEBFINGER_TIMEOUT_MS, maxBytes: MAX_BODY_BYTES })
  if (typeof answer === 'string') {
    logError('cms.webfinger', 'Forwarding the WebFinger lookup failed', { event, cause: answer })
    return empty(event, answer === 'timeout' ? 504 : 502, 'no-store')
  }
  setResponseStatus(event, answer.status)
  setHeader(event, 'Content-Type', passedType(answer.contentType))
  // The body is never a page: no script, style or frame, whatever the CMS sent
  setHeader(event, 'Content-Security-Policy', STATIC_CSP)
  // RFC 7033, section 5: browser clients may look a handle up too
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', answer.status === 200 ? FOUND_CACHE : answer.status >= 500 ? 'no-store' : 'no-cache')
  const retryAfter = Number(answer.retryAfter)
  if (Number.isFinite(retryAfter) && retryAfter > 0) setHeader(event, 'Retry-After', Math.min(Math.ceil(retryAfter), MAX_RETRY_AFTER_SECONDS))
  return answer.body
})

function passedType(contentType: string | undefined): string {
  const essence = contentType?.split(';')[0]?.trim().toLowerCase()
  return essence && PASSED_TYPES.includes(essence) ? contentType! : 'application/octet-stream'
}

function empty(event: H3Event, status: number, cacheControl: string): string {
  setResponseStatus(event, status)
  setHeader(event, 'Cache-Control', cacheControl)
  return ''
}
