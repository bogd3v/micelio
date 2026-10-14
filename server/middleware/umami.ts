import { isUmamiProxyPath } from '~/helpers/analytics'

/** Headers not passed on to Umami: ones a visitor writes to claim an address (the resolved one is sent instead), and credentials. */
const DROPPED_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'x-client-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'fastly-client-ip',
  'x-cluster-client-ip',
  'forwarded',
  'x-micelio-internal-ip',
  'x-micelio-internal-nonce',
  // A visitor's session must not reach the analytics server
  'cookie',
  'authorization',
  // The address of the page, query included: it can carry a reset code or a token
  'referer',
]

const PAYLOAD_METHODS = new Set(['PATCH', 'POST', 'PUT', 'DELETE'])

/** Fetches without following a redirect and turns one into a 502, so Umami's `Location` never reaches the visitor (ASVS V15.3.2). */
async function fetchWithoutRedirect(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, redirect: 'manual' })
  if (response.status >= 300 && response.status < 400) {
    throw createError({ statusCode: 502, statusMessage: 'Bad Gateway' })
  }
  return response
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.umamiUrl) return
  if (!isUmamiProxyPath(event.path, config.public.umamiScriptPath, config.umamiCollectPath)) return

  const ip = clientIp(event)
  // proxyRequest merges extra headers over the visitor's and cannot remove one, so the headers are built here
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(getProxyRequestHeaders(event))) {
    if (typeof value === 'string' && !DROPPED_HEADERS.includes(name.toLowerCase())) headers[name] = value
  }
  // The resolved address goes in both headers; point Umami's CLIENT_IP_HEADER at either
  if (ip !== 'unknown') Object.assign(headers, { 'x-forwarded-for': ip, 'x-real-ip': ip })
  let raw: Buffer | undefined
  if (PAYLOAD_METHODS.has(event.method)) {
    try {
      raw = await readLimitedRaw(event)
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 413) throw error
      raw = undefined
    }
  }
  const body = raw ? new Uint8Array(raw) : undefined
  try {
    return await sendProxy(event, new URL(event.path, config.umamiUrl).href, { fetch: fetchWithoutRedirect, fetchOptions: { method: event.method, body, headers } })
  } catch (error: unknown) {
    // The visitor's answer is the error as it was; the log says that analytics, not the page, failed (ASVS V16.3.4)
    logError('analytics.proxy', 'The analytics proxy call failed', { event, error })
    throw error
  }
})
