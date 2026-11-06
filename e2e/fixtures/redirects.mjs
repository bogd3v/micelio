// `GET /api/micelio/redirects` of micelio-plugin-core (bogd3v/micelio-plugin-core#52, docs/api.md "Redirects"), as both mocks answer it.
// Checked against the real plugin by the steps under Tests of the pull request that added it, not by a test: a mock only copies the answers.
import { createHash } from 'node:crypto'

/**
 * Answers the route like the plugin: the rows in the order they were set, a strong `ETag` of the body, `Cache-Control: public, max-age=60`, `304` when `If-None-Match` names the tag, and the 401 Strapi answers to another token.
 *
 * @param {{ apiToken?: string, rows?: Array<{ from: string, to: string, locale: string | null }> }} [options] - `apiToken`: the API token the route accepts (any when absent); `rows`: the `{ from, to, locale }` rows served at first.
 * @returns `handle` for the mock's router, `rows` (replaced by a test), `calls` (the `site` and `If-None-Match` of each request) `state.failing` (a status the route answers instead, or `0`) and `state.unknownSite` (answer the plugin's `unknownSite` problem detail).
 */
export function createRedirectsMock({ apiToken, rows = [] } = {}) {
  const state = { rows, failing: 0, unknownSite: false }
  /** @type {Array<{ site: unknown, ifNoneMatch: string | undefined }>} */
  const calls = []

  function handle(method, pathname, query, headers) {
    if (method !== 'GET' || pathname !== '/api/micelio/redirects') return null
    calls.push({ site: query.site, ifNoneMatch: headers['if-none-match'] })
    if (apiToken && headers.authorization !== `Bearer ${apiToken}`) return { status: 401, body: { data: null, error: { status: 401, name: 'UnauthorizedError', message: 'Missing or invalid credentials' } } }
    if (state.unknownSite) return { status: 404, body: { type: 'about:blank', title: 'Not Found', status: 404, detail: `There is no site "${query.site}".`, code: 'unknownSite' } }
    if (state.failing) return { status: state.failing, body: { data: null, error: { status: state.failing, name: 'Error', message: 'mock' } } }
    const body = { data: state.rows }
    const etag = `"${createHash('sha256').update(JSON.stringify(body)).digest('base64url')}"`
    const responseHeaders = { 'ETag': etag, 'Cache-Control': 'public, max-age=60' }
    const named = String(headers['if-none-match'] ?? '').split(',').map(tag => tag.trim().replace(/^W\//, ''))
    return named.includes('*') || named.includes(etag) ? { status: 304, headers: responseHeaders } : { status: 200, body, headers: responseHeaders }
  }

  return { handle, state, calls }
}
