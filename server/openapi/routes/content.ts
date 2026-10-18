import { z } from 'zod'
// `~/schemas/*` are the response schemas of `app/schemas/`; `../../schemas/*` are the request schemas of `server/schemas/`
import { fediverseStatsByIdSchema, fediverseStatsSchema } from '~/schemas/fediverse'
import { aboutSchema } from '~/schemas/blocks'
import { commentSchema, commentsResponseSchema, commentTreeSchema } from '~/schemas/comments'
import { siteSchema } from '~/schemas/site'
import { pageSchema } from '~/schemas/pages'
import { articlePageSchema, articleSchema, categoryCountSchema, readingPathSchema, searchResultSchema, tagCountSchema } from '~/schemas/posts'
import { guestCommentSchema } from '../../schemas/comments'
import { pageParamsSchema } from '../../schemas/page'
import { commentsQuerySchema, listLocaleQuerySchema, localeQuerySchema, postParamsSchema, postsQuerySchema, readingPathQuerySchema, searchQuerySchema } from '../../schemas/query'
import type { ParameterSpec, RouteEntry } from '../types'

const READ_CACHE_5_MIN = 'public, s-maxage=300, stale-while-revalidate=600'
const READ_CACHE_10_MIN = 'public, s-maxage=600, stale-while-revalidate=1200'
const READ_CACHE_1_MIN = 'public, s-maxage=60, stale-while-revalidate=120'

const LOCALE_PARAMETER: ParameterSpec = { name: 'locale', in: 'query', description: 'The language of the content: `en` or `es`. An unknown value is a 400; an empty one counts as absent.' }
const RELATION_PARAMETER: ParameterSpec = {
  name: 'relation',
  in: 'query',
  required: true,
  description: 'The article the comments belong to: `api::article.article:<documentId>`. A slug passes validation but the CMS rejects it with a 400.',
  schema: { type: 'string', pattern: '^api::article\\.article:[\\w-]{1,128}$' },
}

/** Operations that read the blog content: articles, search, categories, tags, the reading path, the About page, pages and the site identity. */
export const CONTENT_ROUTES: RouteEntry[] = [
  {
    file: 'server/api/posts/index.get.ts',
    method: 'get',
    path: '/api/posts',
    summary: 'List articles',
    description: 'A page of articles, newest first unless `sort` says otherwise. Search text is used from three characters.',
    tag: 'Content',
    query: postsQuerySchema,
    parameters: [
      { name: 'page', in: 'query', description: 'The page number, from 1. Defaults to 1.' },
      { name: 'pageSize', in: 'query', description: 'Articles per page, 1 to 50. Defaults to 10; a larger value is clamped.' },
      LOCALE_PARAMETER,
      { name: 'category', in: 'query', description: 'Only articles of this category slug.' },
      { name: 'tag', in: 'query', description: 'Only articles with this tag slug.' },
      { name: 'search', in: 'query', description: 'Search text, at most 200 characters.' },
      { name: 'sort', in: 'query', description: 'The order. An unknown value reads as `recent`.', schema: { type: 'string', enum: ['recent', 'oldest', 'fediverse'] } },
      { name: 'content', in: 'query', description: '`1` or `true` searches the article body too and adds a `snippet` to each result.', schema: { type: 'string' } },
    ],
    response: { status: 200, schema: articlePageSchema, description: 'A page of articles.', cache: READ_CACHE_5_MIN },
    errors: ['invalidRequest', 'upstreamUnavailable', 'tooManyRequests'],
  },
  {
    file: 'server/api/posts/[slug].get.ts',
    method: 'get',
    path: '/api/posts/{slug}',
    summary: 'Get an article',
    tag: 'Content',
    params: postParamsSchema,
    query: localeQuerySchema,
    parameters: [
      { name: 'slug', in: 'path', description: 'The article slug, in the alphabet and length of a Strapi uid (256 characters at most).' },
      LOCALE_PARAMETER,
    ],
    response: { status: 200, schema: articleSchema, description: 'The article with its blocks, rendered as sanitized HTML.', cache: READ_CACHE_5_MIN },
    errors: ['invalidRequest', 'notFound', 'upstreamUnavailable'],
  },
  {
    file: 'server/api/search.get.ts',
    method: 'get',
    path: '/api/search',
    summary: 'Search articles',
    description: 'At most ten results. A text under three characters answers an empty list, and so does a CMS failure.',
    tag: 'Content',
    query: searchQuerySchema,
    parameters: [
      { name: 'q', in: 'query', description: 'The search text, at most 200 characters.' },
      LOCALE_PARAMETER,
      { name: 'content', in: 'query', description: '`1` or `true` searches the article body too.', schema: { type: 'string' } },
    ],
    response: { status: 200, schema: z.array(searchResultSchema), description: 'The matching articles.', cache: READ_CACHE_1_MIN },
    errors: ['invalidRequest', 'notFound'],
  },
  {
    file: 'server/api/categories.get.ts',
    method: 'get',
    path: '/api/categories',
    summary: 'List categories with their article count',
    tag: 'Content',
    query: listLocaleQuerySchema,
    parameters: [{ ...LOCALE_PARAMETER, description: 'The language: `en` (default) or `es`.' }],
    response: { status: 200, schema: z.array(categoryCountSchema), description: 'Every category with the number of articles in it.', cache: READ_CACHE_10_MIN },
    errors: ['invalidRequest'],
  },
  {
    file: 'server/api/tags.get.ts',
    method: 'get',
    path: '/api/tags',
    summary: 'List tags with their article count',
    tag: 'Content',
    query: listLocaleQuerySchema,
    parameters: [{ ...LOCALE_PARAMETER, description: 'The language: `en` (default) or `es`.' }],
    response: { status: 200, schema: z.array(tagCountSchema), description: 'Every tag with the number of articles that carry it.', cache: READ_CACHE_10_MIN },
    errors: ['invalidRequest'],
  },
  {
    file: 'server/api/reading-path.get.ts',
    method: 'get',
    path: '/api/reading-path',
    summary: 'Get the reading path of a category',
    description: 'The articles of a category in reading order. `editorial` is false when the CMS has no `pathOrder` yet.',
    tag: 'Content',
    query: readingPathQuerySchema,
    parameters: [
      { name: 'category', in: 'query', description: 'The shape of a category slug (lowercase letters, digits and hyphens, at most 64), trimmed and lowercased; a 400 `Unknown category` when the CMS list has no such category.' },
      LOCALE_PARAMETER,
    ],
    response: { status: 200, schema: readingPathSchema, description: 'The reading path.', cache: READ_CACHE_5_MIN },
    errors: ['invalidRequest', 'upstreamUnavailable'],
  },
  {
    file: 'server/api/about.get.ts',
    method: 'get',
    path: '/api/about',
    summary: 'Get the About page',
    tag: 'Content',
    query: localeQuerySchema,
    parameters: [LOCALE_PARAMETER],
    response: { status: 200, schema: aboutSchema, description: 'The About page content.', cache: READ_CACHE_5_MIN },
    errors: ['invalidRequest', 'notFound', 'upstreamUnavailable'],
  },
  {
    file: 'server/api/pages/[slug].get.ts',
    method: 'get',
    path: '/api/pages/{slug}',
    summary: 'Get a page',
    description: 'A CMS page with its sections validated one by one; an invalid section is dropped alone.',
    tag: 'Content',
    params: pageParamsSchema,
    query: localeQuerySchema,
    parameters: [
      { name: 'slug', in: 'path', description: 'The page slug, a Strapi uid in lowercase.' },
      { ...LOCALE_PARAMETER, description: 'The language: `en` or `es`. The CMS default applies when absent.' },
    ],
    response: { status: 200, schema: pageSchema, description: 'The page.', cache: READ_CACHE_5_MIN },
    errors: ['invalidRequest', 'notFound', 'upstreamUnavailable'],
  },
  {
    file: 'server/api/site.get.ts',
    method: 'get',
    path: '/api/site',
    summary: 'Get the site identity and its modules',
    description: 'Never fails because of the CMS. A normal answer is cached for 5 min; when the CMS fails, the defaults of the app configuration answer instead and are cached for 30 s (`public, s-maxage=30, stale-while-revalidate=60`).',
    tag: 'Content',
    query: listLocaleQuerySchema,
    parameters: [{ ...LOCALE_PARAMETER, description: 'The language: `en` (default) or `es`.' }],
    response: { status: 200, schema: siteSchema, description: 'The site identity, its modules and, when overrides apply, its theme.', cache: READ_CACHE_5_MIN },
    errors: ['invalidRequest'],
  },
  {
    file: 'server/api/comments/index.get.ts',
    method: 'get',
    path: '/api/comments',
    summary: 'List the comments of an article as a tree',
    description: 'Pending and rejected comments are hidden and the author email is never included. Answers `notFound` when the comments module is off.',
    tag: 'Comments',
    query: commentsQuerySchema,
    parameters: [
      RELATION_PARAMETER,
      LOCALE_PARAMETER,
      { name: 'page', in: 'query', description: 'The page number, from 1.' },
      { name: 'pageSize', in: 'query', description: 'Comments per page, at most 50. The CMS default applies when absent.' },
      { name: 'sort', in: 'query', description: 'The order, `field:asc` or `field:desc`.' },
    ],
    response: { status: 200, schema: commentTreeSchema, description: 'The comments, with answers nested in `children`.' },
    errors: ['invalidRequest', 'notFound', 'upstreamUnavailable', 'tooManyRequests'],
  },
  {
    file: 'server/api/comments/flat.get.ts',
    method: 'get',
    path: '/api/comments/flat',
    summary: 'List the comments of an article, flat',
    description: 'Same query as `GET /api/comments`; an answer carries `threadOf` instead of being nested.',
    tag: 'Comments',
    query: commentsQuerySchema,
    parameters: [
      RELATION_PARAMETER,
      LOCALE_PARAMETER,
      { name: 'page', in: 'query', description: 'The page number, from 1.' },
      { name: 'pageSize', in: 'query', description: 'Comments per page, at most 50. The CMS default applies when absent.' },
      { name: 'sort', in: 'query', description: 'The order, `field:asc` or `field:desc`.' },
    ],
    response: { status: 200, schema: commentsResponseSchema, description: 'The comments in a flat list with their pagination.' },
    errors: ['invalidRequest', 'notFound', 'upstreamUnavailable', 'tooManyRequests'],
  },
  {
    file: 'server/api/comments/index.post.ts',
    method: 'post',
    path: '/api/comments',
    summary: 'Post a comment as a guest',
    description: 'Same-origin only and rate limited. The author id is set by the server. Answers `notFound` when the comments module is off.',
    tag: 'Comments',
    parameters: [RELATION_PARAMETER],
    body: guestCommentSchema,
    response: { status: 200, schema: commentSchema, description: 'The comment as stored; a new comment may await moderation.' },
    errors: ['invalidInput', 'invalidRequest', 'forbiddenOrigin', 'notFound', 'payloadTooLarge', 'tooManyRequests', 'upstreamUnavailable'],
  },
  {
    file: 'server/api/fediverse/stats/index.get.ts',
    method: 'get',
    path: '/api/fediverse/stats',
    summary: 'Get the fediverse reactions of several articles',
    description: 'Answers `notFound` when the fediverse module is off.',
    tag: 'Fediverse',
    parameters: [{
      name: 'documentIds',
      in: 'query',
      required: true,
      description: 'Between 1 and 50 article document ids, comma-separated or repeated; each matches `[\\w-]+`.',
      schema: { type: 'array', items: { type: 'string', pattern: '^[\\w-]+$' }, minItems: 1, maxItems: 50 },
    }],
    response: { status: 200, schema: fediverseStatsByIdSchema, description: 'Likes and boosts by document id; an article with no activity is absent.', cache: READ_CACHE_1_MIN },
    errors: ['invalidRequest', 'notFound', 'upstreamUnavailable', 'tooManyRequests'],
  },
  {
    file: 'server/api/fediverse/stats/[documentId].get.ts',
    method: 'get',
    path: '/api/fediverse/stats/{documentId}',
    summary: 'Get the fediverse reactions of one article',
    tag: 'Fediverse',
    parameters: [{ name: 'documentId', in: 'path', description: 'The article document id.', schema: { type: 'string', pattern: '^[\\w-]+$' } }],
    response: { status: 200, schema: fediverseStatsSchema, description: 'Likes and boosts.', cache: READ_CACHE_1_MIN },
    errors: ['invalidRequest', 'notFound', 'upstreamUnavailable', 'tooManyRequests'],
  },
]
