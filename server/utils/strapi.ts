import type { H3Event } from 'h3'
import { strapiRequest, strapiRequestUrl } from '../lib/strapiRequest'
import type { StrapiRequestOptions } from '../lib/strapiRequest'
import type { StrapiRequestConfig } from '../lib/types'
import { forwardHeaders } from '../lib/clientIp'

interface StrapiFetchOptions extends StrapiRequestOptions {
  /**
   * The visitor's request. When given, and the forwarder secret is set, the CMS
   * counts its rate limits against the visitor's address (docs/security.md).
   * Leave it out for calls that are not on behalf of one visitor (caches, feeds).
   */
  event?: H3Event
}

function strapiConfig(): StrapiRequestConfig {
  const config = useRuntimeConfig()
  return { strapiUrl: config.public.strapiUrl, strapiApiToken: config.strapiApiToken }
}

/**
 * The forwarder secret as written. Nitro runs env values through destr, so a
 * secret of digits or JSON would arrive as a number or object: read the raw one.
 * A secret given only in nuxt.config (not the environment) has no raw form and
 * goes through String(): keep it non-numeric there.
 */
export function strapiForwarderSecret(): string {
  const raw = process.env.NUXT_STRAPI_FORWARDER_SECRET ?? process.env.NITRO_STRAPI_FORWARDER_SECRET
  return raw ?? String(useRuntimeConfig().strapiForwarderSecret ?? '')
}

/** Absolute CMS URL, for links and media. Server-side requests go through `strapiFetch`. */
export function strapiUrl(path: string): string {
  return strapiRequestUrl(strapiConfig(), path)
}

/** The headers that name the visitor of `event` to the CMS; empty when forwarding is off. */
export function strapiForwardHeaders(event: H3Event): Record<string, string> {
  return forwardHeaders(strapiForwarderSecret(), clientIp(event))
}

/**
 * Calls the CMS at `path` and resolves with the parsed body, with the API token or the credential of `options.auth`.
 *
 * @remarks
 * Pass `event` for any call made on behalf of a visitor: when the forwarder secret is set, the visitor address and the secret go to the CMS, and, when they are sent, `redirect` is `error` so the secret never follows a redirect. Without `event`, or without the forwarder secret, nothing is forwarded and the CMS counts the call against the server's own address (docs/security.md, "Client IP and rate limits"). Failures are the `ofetch` errors of `strapiRequest`, which the callers handle.
 */
export function strapiFetch<T>(path: string, options: StrapiFetchOptions = {}): Promise<T> {
  const { event, headers, ...request } = options
  const forward = event ? strapiForwardHeaders(event) : {}
  return strapiRequest<T>(strapiConfig(), path, {
    ...request,
    // The secret must not follow a redirect to another host
    ...(Object.keys(forward).length > 0 ? { redirect: 'error' as const } : {}),
    headers: { ...headers, ...forward },
  })
}
