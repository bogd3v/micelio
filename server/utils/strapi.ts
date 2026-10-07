import { strapiRequest, strapiRequestUrl } from './strapiRequest'
import type { StrapiRequestConfig, StrapiRequestOptions } from './strapiRequest'

export type StrapiFetchOptions = StrapiRequestOptions

function strapiConfig(): StrapiRequestConfig {
  const config = useRuntimeConfig()
  return { strapiUrl: config.public.strapiUrl, strapiApiToken: config.strapiApiToken }
}

export function strapiUrl(path: string): string {
  return strapiRequestUrl(strapiConfig(), path)
}

export function strapiFetch<T>(path: string, options: StrapiFetchOptions = {}): Promise<T> {
  return strapiRequest<T>(strapiConfig(), path, options)
}
