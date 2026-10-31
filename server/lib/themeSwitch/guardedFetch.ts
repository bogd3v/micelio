import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { RegistryError } from '../../../modules/theme/registry/error'

/** Resolves a host name to every address it has. */
export type Resolver = (host: string) => Promise<string[]>

function ipv4Private(a: number, b: number): boolean {
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19))
}

/** The IPv4 address inside a NAT64 (`64:ff9b::/96`), 6to4 (`2002::/16`) or IPv4-compatible (`::a.b.c.d`) IPv6 address, as its first two bytes, or `null`. */
function embeddedIpv4(lower: string): [number, number] | null {
  const groups = (text: string): number[] => text.split(':').filter(Boolean).map(group => Number.parseInt(group, 16))
  const dotted = /^(?:64:ff9b::|::)(\d+)\.(\d+)\.\d+\.\d+$/.exec(lower)
  if (dotted) return [Number(dotted[1]), Number(dotted[2])]
  const nat64 = /^64:ff9b::([\da-f]{1,4}):([\da-f]{1,4})$/.exec(lower)
  if (nat64) return [Number.parseInt(nat64[1]!, 16) >> 8, Number.parseInt(nat64[1]!, 16) & 255]
  if (lower.startsWith('2002:')) {
    const [, high = 0] = groups(lower)
    return [high >> 8, high & 255]
  }
  const compatible = /^::([\da-f]{1,4}):([\da-f]{1,4})$/.exec(lower)
  if (compatible) return [Number.parseInt(compatible[1]!, 16) >> 8, Number.parseInt(compatible[1]!, 16) & 255]
  return null
}

/**
 * Whether an address is one a redirect must never reach: loopback, link-local, private, shared or unspecified space, multicast and reserved.
 *
 * @param address - An IPv4 or IPv6 literal; anything else is refused.
 */
export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  const ip = mapped?.[1] ?? address
  const version = isIP(ip)
  if (version === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number)
    return ipv4Private(a, b)
  }
  if (version === 6) {
    const lower = ip.toLowerCase()
    const embedded = embeddedIpv4(lower)
    if (embedded) return ipv4Private(embedded[0], embedded[1])
    return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith('ff')
  }
  return true
}

async function resolveAll(host: string): Promise<string[]> {
  return (await lookup(host, { all: true })).map(found => found.address)
}

/**
 * A `fetch` for the theme registry client that refuses a host other than the registry's own when any address it resolves to is private, and stops with `signal`.
 *
 * @remarks
 * The client follows a redirect (GHCR sends a blob to its storage host) and asks a token realm; every hop comes through here
 * (ADR 0009, section 3). The configured registry itself may be private. The address is checked before the request and the connection resolves it
 * again, so a host that answers differently between the two is not caught: the client allows only `https` hosts with public names.
 *
 * @param options - `registryHost` is the `host[:port]` of the configured registry, exempt from the check; `signal` aborts every request of the attempt
 * (the download deadline); `resolve` resolves names (the system resolver by default) and `fetch` is the one underneath (the global one by default).
 */
export function createGuardedFetch(options: { registryHost: string, signal: AbortSignal, resolve?: Resolver, fetch?: typeof fetch }): typeof fetch {
  const resolve = options.resolve ?? resolveAll
  const send = options.fetch ?? fetch
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.host !== options.registryHost) {
      const host = url.hostname.replace(/^\[|\]$/g, '')
      const addresses = isIP(host) ? [host] : await resolve(host)
      if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new RegistryError('registry', 'a redirect or a token service points at a private address')
    }
    const signal = init?.signal ? AbortSignal.any([init.signal, options.signal]) : options.signal
    return send(input, { ...init, signal })
  }
}
