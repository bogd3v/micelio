import type { RouteEntry } from '../types'

const FEED_TAG = 'Site files'
const FEED_CACHE = 'public, s-maxage=1800, stale-while-revalidate=3600'
const CATEGORY_FEED_PARAMETER = {
  name: 'file',
  in: 'path',
  description: 'The category slug followed by `.xml`, such as `linux.xml`. An unknown category is a 404.',
  schema: { type: 'string', pattern: '^[a-z-]+\\.xml$' },
} as const

/** Operations outside `/api`: the RSS feeds, the sitemap and `robots.txt`. They answer text, not JSON. */
export const SITE_FILE_ROUTES: RouteEntry[] = [
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
    file: 'server/routes/robots.txt.ts',
    method: 'get',
    path: '/robots.txt',
    summary: 'Crawl rules',
    description: 'The crawl rules and the sitemap URL.',
    tag: FEED_TAG,
    response: { status: 200, contentType: 'text/plain', description: 'Plain text in the robots exclusion format.' },
    errors: [],
  },
]
