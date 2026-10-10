/** The frontend requests that make it ask the CMS for everything the mock answers (`mock-shape.spec.ts` records what the frontend sends) */
export const FRONTEND_REQUESTS = [
  '/api/site?locale=en',
  '/api/site?locale=es',
  '/api/posts?locale=en',
  '/api/posts?locale=en&category=garden&tag=compost&search=compost&content=1&sort=oldest',
  '/api/posts/starting-a-balcony-garden?locale=en',
  '/api/posts/no-such-article?locale=en',
  '/api/pages/showcase?locale=en',
  '/api/pages/muestra?locale=es',
  '/api/pages/no-such-page?locale=en',
  '/api/about?locale=en',
  '/api/search?q=ing&locale=en',
  '/api/search?q=ing&locale=en&content=1',
  '/api/categories?locale=en',
  '/api/tags?locale=en',
]

/**
 * Each route `e2e/mock-strapi.mjs` serves, as `METHOD path` (`*` for a prefix), and what the mock check does with it: `compared` when
 * the frontend's requests reach it and the check compares its answer with the CMS's, otherwise the reason it is not. A route the mock
 * gains must be decided here (`test/contractMockRoutes.test.ts`), and a `compared` one must be reached by a request above.
 */
export const MOCK_ROUTES: Record<string, string> = {
  'GET /api/articles/search': 'compared',
  'GET /api/articles': 'compared',
  'GET /api/tags': 'compared',
  'GET /api/categories': 'compared',
  'GET /api/site-setting': 'compared',
  'GET /api/pages': 'compared',
  'GET /api/about': 'compared',
  'GET /api/comments*': 'compared',
  'POST /api/comments*': 'a write: the contract suite makes it on the real CMS (writes.spec.ts)',
  'GET /api/subscribers': 'the demo has the newsletter module off, so the frontend never asks for it',
  'POST /api/subscribers': 'a write: the contract suite makes it on the real CMS (writes.spec.ts)',
  'DELETE /api/subscribers/*': 'a write: the contract suite makes it on the real CMS (writes.spec.ts)',
  'GET /api/fediverse/articles/ranking': 'the demo has the fediverse off',
  'GET /api/fediverse/articles/stats': 'the demo has the fediverse off',
  'GET /api/fediverse/articles/doc-vue-es/stats': 'the demo has the fediverse off',
  'GET /uploads/*': 'static files, not an API answer',
}

export interface KnownDifference {
  /** The route as `routeOf` names it, and the message `mockIssues` gives (scripts/contract/shape.mjs) */
  route: string
  issue: string
  /** Why the mock differs, and whether the frontend depends on it */
  reason: string
}

/**
 * Differences between the mock and the CMS that are known and accepted for now, each with its reason. One that no longer shows is
 * reported as stale: delete it.
 */
export const KNOWN_DIFFERENCES: KnownDifference[] = [
  ...['content', 'readTime'].map(field => ({
    route: '/api/articles',
    issue: `$.data[].${field}: in the mock, not in the CMS`,
    reason: 'The article schema of the CMS has no such field, but the mock invents it and app/helpers/post.ts still reads it',
  })),
  ...['blocks', 'references', 'coverCredit', 'localizations'].map(field => ({
    route: '/api/articles',
    issue: `$.data[].${field}: in the mock, not in the CMS`,
    reason: 'The mock ignores `fields` and `populate`: the list request does not ask the CMS for it, and the one-article request is compared too',
  })),
  ...['page', 'pageSize', 'pageCount'].map(field => ({
    route: '/api/pages',
    issue: `$.meta.pagination.${field}: in the mock, not in the CMS`,
    reason: 'With `pagination[limit]` the CMS answers `start`, `limit` and `total`, the mock the page-based keys',
  })),
  {
    route: '/api/comments/:relation',
    issue: '$: the mock has object, the CMS has array',
    reason: 'The mock answers the flat shape (`data`, `pagination`) for the tree route; the CMS answers the tree as an array',
  },
]

/** The route of a recorded CMS request, with the ids of a comment relation made generic: `/api/comments/:relation/flat` */
export function routeOf(url: string): string {
  const pathname = new URL(url, 'http://localhost').pathname
  return pathname.replace(/^\/api\/comments\/api::article\.article:[^/]+/, '/api/comments/:relation')
}

/** Whether a recorded route is one the mock route (`GET /api/comments*`) serves */
export function servedBy(mockRoute: string, route: string): boolean {
  const path = mockRoute.replace(/^\w+ /, '')
  const generic = path.endsWith('*') ? path.slice(0, -1) : path
  return path.endsWith('*') ? route.startsWith(generic) : route === generic
}
