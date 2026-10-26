// The preview routes of micelio-plugin-core (bogd3v/micelio-plugin-core#44, docs/api.md "Preview"), as both mocks answer them.
// Checked against the real plugin by the steps under Tests of the pull request that added it, not by a test: a mock only copies the answers.
import { draftArticles, draftPage } from './drafts.mjs'

const CONTENT_TYPES = { article: 'api::article.article', page: 'api::page.page' }

function refusal(status, code) {
  const title = status === 403 ? 'Forbidden' : status === 400 ? 'Bad Request' : 'Not Found'
  return { status, body: { type: 'about:blank', title, status, detail: 'mock', code } }
}

/**
 * Answers `POST /api/micelio/preview/exchange` and `GET /api/micelio/preview/draft` like the plugin: a token works once, a grant names one document, and the draft says who the grant acts for (`meta.actor`).
 * A system grant (`issueSystem`, which the plugin mints for itself at publish) lives 60 seconds, is claimed by the first check that matches its document, and is refused when the draft was saved since.
 *
 * @param options.apiToken - The API token the routes accept; any other, or none, is the 401 Strapi answers.
 */
export function createPreviewMock({ apiToken } = {}) {
  const tokens = new Map()
  const grants = new Map()
  const systemGrants = new Map()
  const calls = []
  let count = 0
  const state = { permission: true, omitActor: false }

  function authorised(headers) {
    return !apiToken || headers.authorization === `Bearer ${apiToken}`
  }

  /**
   * Makes a token for a draft, as the admin's token route does.
   *
   * @param {{ kind?: 'article' | 'page', documentId: string, locale?: string, adminOrigin: string }} binding
   */
  function issue({ kind = 'article', documentId, locale = 'en', adminOrigin }) {
    const token = `preview-token-${++count}-${'x'.repeat(24)}`
    tokens.set(token, { contentType: CONTENT_TYPES[kind], documentId, locale, adminOrigin, expiresAt: Date.now() + 60_000, used: false })
    return token
  }

  function currentVersion(kind, documentId, locale) {
    return kind === 'page' ? draftPage.updatedAt : draftArticles.find(article => article.documentId === documentId && article.locale === locale)?.updatedAt
  }

  /**
   * Makes a system grant for one version of a draft, as the plugin's `issueSystemGrant` does.
   *
   * @param {{ kind?: 'article' | 'page', documentId: string, locale?: string, version?: string }} binding - `version` is the `updatedAt` of the draft, as it is now when absent.
   */
  function issueSystem({ kind = 'article', documentId, locale = 'en', version = currentVersion(kind, documentId, locale) }) {
    const grant = `system-grant-${++count}-${'z'.repeat(24)}`
    systemGrants.set(grant, { contentType: CONTENT_TYPES[kind], documentId, locale, version, expiresAt: Date.now() + 60_000, used: false })
    return grant
  }

  /** Ends every grant, as the 15 minutes and the 60 seconds do. */
  function expireGrants() {
    for (const grant of [...grants.values(), ...systemGrants.values()]) grant.expiresAt = 0
  }

  function exchange(headers, body) {
    calls.push({ kind: 'exchange', authorization: headers.authorization, token: body?.token })
    if (!authorised(headers)) return refusal(401, 'unauthorized')
    if (!state.permission) return refusal(403, 'forbidden')
    const token = typeof body?.token === 'string' ? tokens.get(body.token) : undefined
    if (!token || token.used || token.expiresAt < Date.now()) return refusal(404, 'previewRefused')
    token.used = true
    const grant = `preview-grant-${++count}-${'y'.repeat(24)}`
    const expiresAt = Date.now() + 15 * 60_000
    grants.set(grant, { ...token, expiresAt })
    return { status: 200, body: { data: { grant, expiresAt: new Date(expiresAt).toISOString(), adminOrigin: token.adminOrigin, contentType: token.contentType, documentId: token.documentId, locale: token.locale } } }
  }

  function draft(headers, query) {
    const value = headers['x-micelio-preview-grant']
    calls.push({ kind: 'draft', authorization: headers.authorization, grant: value, query })
    if (!authorised(headers)) return refusal(401, 'unauthorized')
    if (!state.permission) return refusal(403, 'forbidden')
    if (typeof value !== 'string' || typeof query.documentId !== 'string') return refusal(400, 'previewRequestInvalid')
    const system = systemGrants.get(value)
    const grant = system ?? grants.get(value)
    if (!grant || grant.expiresAt < Date.now() || grant.documentId !== query.documentId) return refusal(404, 'previewRefused')
    if (query.locale !== undefined && query.locale !== grant.locale) return refusal(404, 'previewRefused')
    // One conditional update in the plugin: the first check that matches claims it
    if (system) {
      if (system.used) return refusal(404, 'previewRefused')
      system.used = true
    }
    const entry = grant.contentType === CONTENT_TYPES.page
      ? [draftPage].find(page => page.documentId === grant.documentId)
      : draftArticles.find(article => article.documentId === grant.documentId && article.locale === grant.locale)
    if (system && entry?.updatedAt !== system.version) return refusal(404, 'previewRefused')
    return entry ? { status: 200, body: { data: entry, meta: state.omitActor ? {} : { actor: system ? 'system' : 'admin' } } } : refusal(404, 'previewRefused')
  }

  function handle(method, pathname, query, headers, body) {
    if (method === 'POST' && pathname === '/api/micelio/preview/exchange') return exchange(headers, body)
    if (method === 'GET' && pathname === '/api/micelio/preview/draft') return draft(headers, query)
    return null
  }

  return { handle, issue, issueSystem, expireGrants, calls, state }
}
