import { isSafeForwardTarget } from './clientIp'

/** An upstream service the server calls, by the runtime setting that holds its URL. */
export interface UpstreamSetting {
  /** The environment variable the operator sets, for the error message. */
  variable: string
  /** Its value; empty means the service is not used. */
  url: string
}

/**
 * The error text for the first upstream reached over plain `http://` outside a private network, or `null` when every configured one is acceptable.
 *
 * @remarks
 * Same rule as the forwarder secret (`isSafeForwardTarget`): `https`, or `http` to a loopback or private address, `localhost`, a dotless service name, `.internal` or `.local`. The API token, the visitors' JWTs and passwords, and the analytics payload travel to these hosts (ASVS V12.3.1, V12.3.3; ADR 0011).
 */
export function insecureUpstream(upstreams: UpstreamSetting[]): string | null {
  for (const { variable, url } of upstreams) {
    if (!url || isSafeForwardTarget(url)) continue
    return `${variable} is plain http to a host outside a private network: the API token, sessions and visitor data would travel in the clear. Use https, or a private address or service name`
  }
  return null
}
