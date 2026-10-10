import { timingSafeEqual } from 'node:crypto'
import { BlockList, isIP } from 'node:net'

/**
 * Visitor address resolution (micelio-cms #100). The leftmost `X-Forwarded-For`
 * entry is written by the visitor, so the header is read only as far as the
 * operator's `NUXT_TRUST_PROXY` allows. Same model as the CMS's `TRUST_PROXY`.
 * Pure functions: docs/security.md, "Client IP".
 */

export type TrustProxy
  = | { kind: 'none' }
    | { kind: 'hops', hops: number }
    | { kind: 'peers', trusted: BlockList }

interface ResolvedIp {
  /** Normalised address, `unknown` when the socket has none. */
  ip: string
  /** `hops` found fewer entries than asked: the server is reached directly. */
  shortChain: boolean
}

/** Longest chain read from the header: more entries than any real proxy path. */
const MAX_CHAIN = 64

/** Groups of an IPv6 address (eight 16-bit numbers), or null if it isn't one. */
function expandIPv6(address: string): number[] | null {
  if (isIP(address) !== 6) return null
  let text = address
  const lastColon = text.lastIndexOf(':')
  const tail = text.slice(lastColon + 1)
  if (tail.includes('.')) {
    const octets = tail.split('.').map(Number)
    const high = (((octets[0] ?? 0) << 8) | (octets[1] ?? 0)).toString(16)
    const low = (((octets[2] ?? 0) << 8) | (octets[3] ?? 0)).toString(16)
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`
  }
  const [head, rest] = text.split('::')
  const first = head ? head.split(':') : []
  const last = rest === undefined ? [] : rest ? rest.split(':') : []
  const fill = rest === undefined ? 0 : 8 - first.length - last.length
  if (fill < 0) return null
  const groups = [...first, ...Array<string>(fill).fill('0'), ...last].map(g => parseInt(g, 16))
  return groups.length === 8 && groups.every(g => Number.isInteger(g)) ? groups : null
}

/** Shortest textual form: lowercase hex, longest run of zero groups as `::`. */
function compressIPv6(groups: number[]): string {
  let bestStart = -1
  let bestLength = 0
  for (let i = 0; i < 8; i++) {
    if (groups[i] !== 0) continue
    let j = i
    while (j < 8 && groups[j] === 0) j++
    if (j - i > bestLength) {
      bestStart = i
      bestLength = j - i
    }
    i = j
  }
  const hex = groups.map(g => g.toString(16))
  if (bestLength < 2) return hex.join(':')
  return `${hex.slice(0, bestStart).join(':')}::${hex.slice(bestStart + bestLength).join(':')}`
}

/**
 * One textual form per address: no port, brackets or zone, lowercase, and
 * `::ffff:a.b.c.d` as plain IPv4. Null when it isn't an IP address.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  let text = raw.trim()
  if (text.startsWith('[')) {
    const end = text.indexOf(']')
    if (end < 0 || !/^(:\d+)?$/.test(text.slice(end + 1))) return null
    text = text.slice(1, end)
  } else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(text)) {
    text = text.slice(0, text.lastIndexOf(':'))
  }
  const zone = text.indexOf('%')
  if (zone >= 0) text = text.slice(0, zone)

  if (isIP(text) === 4) return text
  const groups = expandIPv6(text)
  if (!groups) return null
  if (groups.slice(0, 5).every(g => g === 0) && groups[5] === 0xffff) {
    return `${groups[6]! >> 8}.${groups[6]! & 255}.${groups[7]! >> 8}.${groups[7]! & 255}`
  }
  return compressIPv6(groups)
}

/** True for a valid IPv4 or IPv6 address, as written (no port or brackets). */
export function isIpAddress(value: string | null | undefined): value is string {
  return typeof value === 'string' && isIP(value) !== 0
}

/** Loopback, RFC 1918, link-local and unique-local (IPv6) ranges. */
const PRIVATE_RANGES: [string, number, 'ipv4' | 'ipv6'][] = [
  ['127.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['::1', 128, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
]

function privateRanges(): BlockList {
  const list = new BlockList()
  for (const rule of PRIVATE_RANGES) list.addSubnet(...rule)
  return list
}

/**
 * Parses `NUXT_TRUST_PROXY`: `private` (default, also the empty value), `false`
 * (or `0`), a number of proxy hops, or a comma separated list of addresses and
 * CIDR ranges where `private` stands for the private ranges. `true` is
 * refused: it would trust whatever the visitor writes.
 */
export function parseTrustProxy(raw: unknown): TrustProxy {
  // Nitro runs env values through destr: `false`, `0`, `2` and `true` arrive as boolean or number
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === '' || value === 'private') return { kind: 'peers', trusted: privateRanges() }
  if (value === 'false' || value === '0' || value === 'none') return { kind: 'none' }
  if (value === 'true') {
    throw new Error(
      'NUXT_TRUST_PROXY=true is not allowed: it trusts any X-Forwarded-For. Use "private", a number of proxy hops, a list of proxy CIDR ranges, or "false"',
    )
  }
  if (/^\d+$/.test(value)) return { kind: 'hops', hops: Number(value) }

  const trusted = new BlockList()
  for (const entry of value.split(',')) {
    const item = entry.trim()
    if (item === 'private') {
      for (const rule of PRIVATE_RANGES) trusted.addSubnet(...rule)
      continue
    }
    const [address = '', prefixText, ...extra] = item.split('/')
    const normalized = normalizeIp(address)
    const family = normalized ? (isIP(normalized) === 4 ? 'ipv4' : 'ipv6') : null
    const max = family === 'ipv4' ? 32 : 128
    const prefix = prefixText === undefined ? max : Number(prefixText)
    if (
      !normalized
      || !family
      || extra.length > 0
      || (prefixText !== undefined && !/^\d+$/.test(prefixText))
      // A /0 range trusts every address: the same as NUXT_TRUST_PROXY=true.
      || prefix < 1
      || prefix > max
    ) {
      throw new Error(`NUXT_TRUST_PROXY has an entry that is not an IP address or CIDR range: "${item}"`)
    }
    trusted.addSubnet(normalized, prefix, family)
  }
  return { kind: 'peers', trusted }
}

function isTrusted(list: BlockList, ip: string): boolean {
  return list.check(ip, isIP(ip) === 4 ? 'ipv4' : 'ipv6')
}

/**
 * The visitor address for one request. `peer` is the socket's remote address
 * and `header` the value of the proxy header (`NUXT_PROXY_IP_HEADER`).
 */
export function resolveClientIp(
  trust: TrustProxy,
  peer: string | null | undefined,
  header: string | null | undefined,
): ResolvedIp {
  const socket = normalizeIp(peer) ?? 'unknown'
  if (trust.kind === 'none') return { ip: socket, shortChain: false }

  const chain = (header ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .slice(-MAX_CHAIN)

  if (trust.kind === 'hops') {
    if (chain.length < trust.hops) return { ip: socket, shortChain: true }
    const entry = normalizeIp(chain[chain.length - trust.hops])
    return { ip: entry ?? socket, shortChain: false }
  }

  // Walk from the connection outwards while each hop is a trusted proxy.
  if (socket === 'unknown' || !isTrusted(trust.trusted, socket) || chain.length === 0) {
    return { ip: socket, shortChain: false }
  }
  let candidate = socket
  for (let i = chain.length - 1; i >= 0; i--) {
    const entry = normalizeIp(chain[i])
    if (!entry) return { ip: socket, shortChain: false }
    candidate = entry
    if (!isTrusted(trust.trusted, entry)) break
  }
  return { ip: candidate, shortChain: false }
}

/** Minimum length of the forwarder secret, as in the CMS. */
const MIN_FORWARDER_SECRET_LENGTH = 32

const FORWARDER_SECRET_HEADER = 'X-Micelio-Forwarder-Secret'
export const FORWARDER_IP_HEADER = 'X-Micelio-Client-IP'

/** Only a same-origin relative path (`/api/x`, not `//host` or an absolute URL) gets the internal headers. */
export function isInternalFetchTarget(request: unknown): boolean {
  return typeof request === 'string' && request.startsWith('/') && !request.startsWith('//')
}

/**
 * The visitor address an in-process call carries, or null. Accepted only when
 * the socket has no remote address (the call never left the process) and the
 * nonce of this process matches; an outside request is never trusted with it.
 */
export function internalClientIp(
  peer: string | null | undefined,
  ipHeader: string | null | undefined,
  nonceHeader: string | null | undefined,
  nonce: string,
): string | null {
  if (peer || !ipHeader || !nonceHeader || !nonce) return null
  const given = Buffer.from(nonceHeader)
  const expected = Buffer.from(nonce)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return normalizeIp(ipHeader)
}

/**
 * Headers that name the visitor to the CMS. Empty when forwarding is off or
 * `ip` is not an IP address; throws when the secret is set but too short. The
 * secret is used exactly as written (the CMS compares it untrimmed).
 */
export function forwardHeaders(secret: unknown, ip: string | null | undefined): Record<string, string> {
  const value = secret === undefined || secret === null ? '' : String(secret)
  if (!value) return {}
  if (value.length < MIN_FORWARDER_SECRET_LENGTH) {
    throw new Error(`NUXT_STRAPI_FORWARDER_SECRET must have at least ${MIN_FORWARDER_SECRET_LENGTH} characters`)
  }
  if (!isIpAddress(ip)) return {}
  return { [FORWARDER_SECRET_HEADER]: value, [FORWARDER_IP_HEADER]: ip }
}

/**
 * The secret goes only to a CMS reached over https or inside a private
 * network (loopback or private address, `localhost`, a dotless service name,
 * `.internal`, `.local`); plain http over the internet would expose it.
 */
export function isSafeForwardTarget(strapiUrl: string): boolean {
  if (!URL.canParse(strapiUrl)) return false
  const url = new URL(strapiUrl)
  if (url.protocol === 'https:') return true
  if (url.protocol !== 'http:') return false
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const address = normalizeIp(host)
  if (address) return isTrusted(privateRanges(), address)
  return host === 'localhost' || !host.includes('.') || /\.(internal|local|localhost)$/.test(host)
}
