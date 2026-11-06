import type { RedirectRow } from '../../app/helpers/redirects'
import { redirectsResponseSchema } from '../schemas/redirects'
import { strapiRequestRaw } from './strapiRequest'
import type { StrapiRequestConfig } from './types'

// The redirects are not on the way to a page: a slow CMS must not hold the page for long
const REDIRECTS_TIMEOUT_MS = 3000

/** What `fetchRedirects` found: the list changed (with the tag to ask again with), it did not, the CMS has no such route, the plugin does not know the site, or the token may not read it. */
export type RedirectsAnswer
  = | { status: 'changed', rows: RedirectRow[], etag: string | null }
    | { status: 'unchanged' }
    | { status: 'absent' }
    | { status: 'unknownSite' }
    | { status: 'forbidden' }

/**
 * Reads the site's redirects from the plugin (`GET /api/micelio/redirects?site=`), asking again with the `ETag` of the last answer.
 *
 * @param site - The slug of the plugin's site; empty names none, so the plugin picks it by host or the default.
 * @param etag - The tag of the list in hand: a `304` resolves `unchanged`.
 *
 * @remarks
 * A `404` is a CMS without the plugin or a plugin before its redirects, and resolves `absent`; a `404` whose problem detail has the code `unknownSite` (a wrong site slug, or no default site) resolves `unknownSite`, and a `403` (a token without the grant `plugin::micelio.redirects.find`) `forbidden`. Any other failure, and an answer that is not the list, rejects.
 */
export async function fetchRedirects(config: StrapiRequestConfig, site: string, etag: string | null, timeout = REDIRECTS_TIMEOUT_MS): Promise<RedirectsAnswer> {
  const query = site ? `?${new URLSearchParams({ site })}` : ''
  try {
    const response = await strapiRequestRaw<unknown>(config, `/api/micelio/redirects${query}`, { timeout, headers: etag ? { 'If-None-Match': etag } : {} })
    // ofetch resolves a 304 (it has no body to fail on) rather than rejecting
    if (response.status === 304) return { status: 'unchanged' }
    return { status: 'changed', rows: redirectsResponseSchema.parse(response._data).data, etag: response.headers.get('etag') }
  } catch (error) {
    const { response, data } = error as { response?: { status?: number }, data?: { code?: unknown } }
    const status = response?.status
    if (status === 404) return { status: data?.code === 'unknownSite' ? 'unknownSite' : 'absent' }
    if (status === 403) return { status: 'forbidden' }
    throw error
  }
}
