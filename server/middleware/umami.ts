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
]

const PAYLOAD_METHODS = new Set(['PATCH', 'POST', 'PUT', 'DELETE'])

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
  const raw = PAYLOAD_METHODS.has(event.method) ? await readRawBody(event, false).catch(() => undefined) : undefined
  const body = raw ? new Uint8Array(raw) : undefined
  return sendProxy(event, new URL(event.path, config.umamiUrl).href, { fetchOptions: { method: event.method, body, headers } })
})
