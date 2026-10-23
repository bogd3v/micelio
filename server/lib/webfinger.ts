/** The CMS's answer to a WebFinger lookup, as the site domain sends it on. */
export interface WebFingerAnswer {
  status: number
  /** The CMS's `Content-Type` (`application/jrd+json` for a found account); absent when the CMS sent none. */
  contentType?: string
  /** The CMS's `Retry-After`, as sent, on a 429 or 503. */
  retryAfter?: string
  body: Uint8Array
}

/** Why a lookup got no answer from the CMS: it took too long, or it failed, redirected or sent a body over the cap. */
export type WebFingerFailure = 'timeout' | 'unavailable'

/** Limits of one forwarded lookup. */
export interface WebFingerLimits {
  timeoutMs: number
  /** The largest body read from the CMS; a longer one is a failure, not a truncated answer. */
  maxBytes: number
}

/**
 * Asks the CMS's WebFinger endpoint about `resource` and resolves with its status, `Content-Type` and body, whatever the status.
 *
 * @remarks
 * Only `resource` is sent, with no visitor header, cookie or credential: the lookup is public and the CMS answers it the same for everyone. A missing `resource` sends none, so the CMS answers its own 400. A redirect is never followed (ASVS V15.3.2).
 *
 * @param webFingerUrl - The absolute URL of the CMS's `/.well-known/webfinger`, without a query.
 * @returns The answer, or the failure when the CMS could not be reached, timed out, redirected or sent more than `maxBytes`.
 */
export async function forwardWebFinger(webFingerUrl: string, resource: string | undefined, limits: WebFingerLimits): Promise<WebFingerAnswer | WebFingerFailure> {
  const url = new URL(webFingerUrl)
  if (resource !== undefined) url.searchParams.set('resource', resource)
  const signal = AbortSignal.timeout(limits.timeoutMs)
  try {
    const response = await fetch(url, { headers: { accept: 'application/jrd+json, application/json' }, redirect: 'manual', signal })
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel()
      return 'unavailable'
    }
    const body = await readCapped(response, limits.maxBytes)
    if (!body) return 'unavailable'
    const contentType = response.headers.get('content-type') ?? undefined
    const retryAfter = response.headers.get('retry-after') ?? undefined
    return { status: response.status, ...(contentType && { contentType }), ...(retryAfter && { retryAfter }), body }
  } catch {
    // The route logs which failure it was; the error itself carries nothing the visitor may see
    return signal.aborted ? 'timeout' : 'unavailable'
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await reader.cancel()
    return null
  }
  const chunks: Uint8Array[] = []
  let size = 0
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(read.value)
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}
