import { ofetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'

const DEFAULT_TIMEOUT_MS = 10_000

export type StrapiRequestOptions = Pick<FetchOptions<'json'>, 'method' | 'query' | 'body' | 'timeout'>

/** What a call to Strapi needs: the pure part of `strapiFetch`, usable outside Nitro (build modules). */
export interface StrapiRequestConfig {
  strapiUrl: string
  strapiApiToken?: string
}

export function strapiRequestUrl(config: Pick<StrapiRequestConfig, 'strapiUrl'>, path: string): string {
  return `${config.strapiUrl.replace(/\/+$/, '')}${path}`
}

export function strapiRequest<T>(config: StrapiRequestConfig, path: string, options: StrapiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = config.strapiApiToken ? { Authorization: `Bearer ${config.strapiApiToken}` } : {}
  return ofetch<T>(strapiRequestUrl(config, path), { timeout: DEFAULT_TIMEOUT_MS, ...options, headers })
}
