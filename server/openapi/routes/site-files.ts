import type { RouteEntry } from '../types'

const FEED_TAG = 'Site files'
const FEED_CACHE = 'public, s-maxage=1800, stale-while-revalidate=3600'
const CATEGORY_FEED_PARAMETER = {
  name: 'file',
  in: 'path',
  description: 'The category slug followed by `.xml`, such as `garden.xml`. An unknown category is a 404.',
  schema: { type: 'string', pattern: '^[a-z-]+\\.xml$' },
} as const

/** The preview entry point, which opens the admin's iframe on a draft (ADR 0019). */
const PREVIEW_ROUTES: RouteEntry[] = [
  {
    file: 'server/routes/_preview.get.ts',
    method: 'get',
    path: '/_preview',
    summary: 'Open a draft in the admin\'s iframe with a preview token',
    description: 'The CMS gives the admin page a one-use token (`docs/operate/preview.md`); the frame opens this route with it. The frontend exchanges the token for a grant, keeps the grant in the `__Host-micelio_preview` cookie (`HttpOnly`, `Secure`, `SameSite=None`, `Partitioned`) and redirects to the draft route without the token. A token that is used, expired, altered or of another site, a grant for another admin origin, and a site with `NUXT_PREVIEW_ADMIN_ORIGIN` unset all answer the same 404 page. Answers `private, no-store`.',
    tag: 'Drafts',
    parameters: [
      { name: 'token', in: 'query', description: 'The preview token.', schema: { type: 'string' }, required: true },
      { name: 'mode', in: 'query', description: 'The mode of the draft route: `dynamic` (default) or `static`, which leaves every island on its static alternative.', schema: { type: 'string', enum: ['dynamic', 'static'] } },
    ],
    response: { status: 303, description: 'The draft route of the document the grant names, without the token.' },
    errors: ['notFound', 'tooManyRequests', 'upstreamUnavailable'],
  },
]

/** Operations outside `/api`: the RSS feeds, the sitemap, `robots.txt`, `security.txt` and WebFinger. They answer text or a JRD, not problem details. */
export const SITE_FILE_ROUTES: RouteEntry[] = [
  ...PREVIEW_ROUTES,
  {
    file: 'server/routes/feed.xml.ts',
    method: 'get',
    path: '/feed.xml',
    summary: 'RSS feed of the latest articles',
    description: 'RSS 2.0 of the latest 50 articles. Answers `notFound` on a site with no blog.',
    tag: FEED_TAG,
    parameters: [{ name: 'lang', in: 'query', description: 'The language of the feed: `es` for Spanish, English for anything else.', schema: { type: 'string' } }],
    response: { status: 200, contentType: 'application/rss+xml', description: 'An RSS 2.0 document.', cache: FEED_CACHE },
    errors: ['notFound', 'internalError'],
  },
  {
    file: 'server/routes/es/feed.xml.ts',
    method: 'get',
    path: '/es/feed.xml',
    summary: 'RSS feed of the latest articles, in Spanish',
    tag: FEED_TAG,
    response: { status: 200, contentType: 'application/rss+xml', description: 'An RSS 2.0 document.', cache: FEED_CACHE },
    errors: ['notFound', 'internalError'],
  },
  {
    file: 'server/routes/feed/[file].ts',
    method: 'get',
    path: '/feed/{file}',
    summary: 'RSS feed of one category',
    tag: FEED_TAG,
    parameters: [CATEGORY_FEED_PARAMETER],
    response: { status: 200, contentType: 'application/rss+xml', description: 'An RSS 2.0 document.', cache: FEED_CACHE },
    errors: ['notFound', 'internalError'],
  },
  {
    file: 'server/routes/es/feed/[file].ts',
    method: 'get',
    path: '/es/feed/{file}',
    summary: 'RSS feed of one category, in Spanish',
    tag: FEED_TAG,
    parameters: [CATEGORY_FEED_PARAMETER],
    response: { status: 200, contentType: 'application/rss+xml', description: 'An RSS 2.0 document.', cache: FEED_CACHE },
    errors: ['notFound', 'internalError'],
  },
  {
    file: 'server/routes/sitemap.xml.ts',
    method: 'get',
    path: '/sitemap.xml',
    summary: 'Sitemap',
    description: 'Every page, article and category in both languages, with `hreflang` alternates.',
    tag: FEED_TAG,
    response: { status: 200, contentType: 'application/xml', description: 'A sitemap document.', cache: 'public, s-maxage=3600, stale-while-revalidate=7200' },
    errors: ['internalError'],
  },
  {
    file: 'server/routes/_t/[...rest].get.ts',
    method: 'get',
    path: '/_t/{digest}/{path}',
    summary: 'A file of the active theme',
    description: 'A stylesheet, font, image or `runtime.json` of a compiled theme, from the bytes verified when it was loaded. `digest` is the 64 hex digits of the entry the site serves; any other digest, and any file the entry does not list, answers the same empty `notFound`. Brotli or gzip is sent when the request accepts it, with `Vary: Accept-Encoding`. The file is immutable (the digest changes with the content), `nosniff` and sandboxed by the static CSP.',
    tag: FEED_TAG,
    parameters: [
      { name: 'digest', in: 'path', description: 'The digest of a theme entry the site serves.', schema: { type: 'string', pattern: '^[0-9a-f]{64}$' } },
      { name: 'path', in: 'path', description: 'A file of the entry, such as `theme.css` or `fonts/archivo.woff2`.', schema: { type: 'string' } },
    ],
    response: { status: 200, contentType: 'application/octet-stream', description: 'The file, with its own content type (`text/css`, `application/json`, `font/woff2`, an image type).', cache: 'public, max-age=31536000, immutable' },
    errors: ['notFound'],
  },
  {
    file: 'server/routes/robots.txt.ts',
    method: 'get',
    path: '/robots.txt',
    summary: 'Crawl rules',
    description: 'The crawl rules and the sitemap URL.',
    tag: FEED_TAG,
    response: { status: 200, contentType: 'text/plain', description: 'Plain text in the robots exclusion format.' },
    errors: [],
  },
  {
    file: 'server/routes/.well-known/security.txt.ts',
    method: 'get',
    path: '/.well-known/security.txt',
    summary: 'Security contact',
    description: 'The security contact of the site (RFC 9116): `Contact` from the site settings, `Expires` 180 days after the render, `Preferred-Languages` and `Canonical`. Answers `notFound` with an empty body when the settings have no valid contact, and never invents one.',
    tag: FEED_TAG,
    response: { status: 200, contentType: 'text/plain', description: 'Plain text in the `security.txt` format.', cache: 'public, max-age=3600' },
    errors: ['notFound'],
    errorDetails: { notFound: 'The body is empty, not a problem document: a client of `security.txt` expects a plain 404.' },
  },
  {
    file: 'server/routes/.well-known/webfinger.get.ts',
    method: 'get',
    path: '/.well-known/webfinger',
    summary: 'WebFinger lookup of the site account',
    description: 'WebFinger (RFC 7033) on the site domain, so the handle `@<user>@<site host>` resolves without a proxy rule: the CMS answer for `resource`, with its status, body and `Content-Type`. Only `resource` is sent to the CMS (the first one, when repeated), with no visitor header, cookie or credential. A `Content-Type` other than JRD, JSON or plain text goes out as `application/octet-stream`. Answers `notFound` with an empty body when the fediverse module is off. A CMS that takes more than 5 seconds answers an empty `504`.',
    tag: FEED_TAG,
    parameters: [{ name: 'resource', in: 'query', description: 'The account to look up, such as `acct:blog@example.com`; at most 1024 characters.', schema: { type: 'string', maxLength: 1024 } }],
    response: { status: 200, contentType: 'application/jrd+json', description: 'The JSON Resource Descriptor of the account, with `Access-Control-Allow-Origin: *`.', cache: 'public, max-age=300' },
    errors: ['notFound', 'invalidRequest', 'tooManyRequests', 'upstreamUnavailable'],
    errorDetails: {
      tooManyRequests: 'An empty body with `Retry-After`: 30 lookups a minute per visitor, 300 for the site; or the CMS\'s own 429, passed on with its `Retry-After`.',
      notFound: 'The fediverse module is off (empty body), or the CMS knows no such account (its body). Not a problem document: a WebFinger client expects the CMS answer.',
      invalidRequest: 'The CMS answer for a missing `resource`, or an empty body for one longer than 1024 characters.',
      upstreamUnavailable: 'An empty body: the CMS could not be reached, redirected, or sent more than 64 KiB. Any other CMS error passes through with its status and body.',
    },
  },
]
