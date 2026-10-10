import { ofetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'
import type { StrapiRequestConfig } from './types'

const DEFAULT_TIMEOUT_MS = 10_000

/** Options of one call to the CMS: the `ofetch` options the server uses, plus the credential and the extra headers. */
export interface StrapiRequestOptions extends Pick<FetchOptions<'json'>, 'method' | 'query' | 'body' | 'timeout' | 'redirect'> {
  /** Credential sent: the API token (default), none (anonymous endpoints) or a user's JWT. */
  auth?: 'token' | 'none' | { jwt: string }
  /** Extra request headers, e.g. the visitor forwarding headers. Never `Authorization`. */
  headers?: Record<string, string>
}

/** The absolute CMS URL of `path`, with the trailing slashes of the configured base URL removed. */
export function strapiRequestUrl(config: Pick<StrapiRequestConfig, 'strapiUrl'>, path: string): string {
  return `${config.strapiUrl.replace(/\/+$/, '')}${path}`
}

/**
 * Calls the CMS at `path` and resolves with the parsed JSON body.
 *
 * @remarks
 * The credential is the API token unless `auth` says otherwise. A non-2xx answer rejects with the `ofetch` error, whose `response.status` the callers read. The timeout defaults to 10 seconds and `options` may change it. An `Authorization` entry in `headers` is always dropped. Route code uses `strapiFetch` from `server/utils/strapi.ts`, not this function.
 */
export function strapiRequest<T>(config: StrapiRequestConfig, path: string, options: StrapiRequestOptions = {}): Promise<T> {
  const { auth = 'token', headers: extra, ...fetchOptions } = options
  const bearer = typeof auth === 'object' ? auth.jwt : auth === 'token' ? config.strapiApiToken : ''
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(extra ?? {}).filter(([name]) => name.toLowerCase() !== 'authorization')),
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
  }
  return ofetch<T>(strapiRequestUrl(config, path), { timeout: DEFAULT_TIMEOUT_MS, ...fetchOptions, headers })
}
