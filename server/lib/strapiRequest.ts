import { ofetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'
import type { StrapiRequestConfig } from './types'

const DEFAULT_TIMEOUT_MS = 10_000

export interface StrapiRequestOptions extends Pick<FetchOptions<'json'>, 'method' | 'query' | 'body' | 'timeout' | 'redirect'> {
  /** Credential sent: the API token (default), none (anonymous endpoints) or a user's JWT. */
  auth?: 'token' | 'none' | { jwt: string }
  /** Extra request headers, e.g. the visitor forwarding headers. Never `Authorization`. */
  headers?: Record<string, string>
}

export function strapiRequestUrl(config: Pick<StrapiRequestConfig, 'strapiUrl'>, path: string): string {
  return `${config.strapiUrl.replace(/\/+$/, '')}${path}`
}

export function strapiRequest<T>(config: StrapiRequestConfig, path: string, options: StrapiRequestOptions = {}): Promise<T> {
  const { auth = 'token', headers: extra, ...fetchOptions } = options
  const bearer = typeof auth === 'object' ? auth.jwt : auth === 'token' ? config.strapiApiToken : ''
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(extra ?? {}).filter(([name]) => name.toLowerCase() !== 'authorization')),
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
  }
  return ofetch<T>(strapiRequestUrl(config, path), { timeout: DEFAULT_TIMEOUT_MS, ...fetchOptions, headers })
}
