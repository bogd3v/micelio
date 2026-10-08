import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import qs from 'qs'
import type { RawStrapiArticle, StrapiAuthorRef, StrapiCategoryRef, StrapiLocalization, StrapiMediaRef, StrapiSEO, StrapiTagRef } from '~/interfaces/strapi-post'
import type { StrapiRichText } from '~/interfaces/strapi-blocks'
import { createAuthMock } from '../../e2e/fixtures/auth.mjs'
import { createDraftsMock } from '../../e2e/fixtures/drafts.mjs'
import { triangleGlb } from '../../e2e/fixtures/glb.mjs'
import { findPages } from '../../e2e/fixtures/pages.mjs'

export interface RecordedRequest {
  method: string
  path: string
  query: Record<string, unknown>
  body?: { data?: Record<string, unknown>, locale?: unknown }
  rawBody?: Record<string, unknown>
  authorization?: string
  /** The visitor forwarding headers, when the request carried them */
  forwarder?: { secret?: string, ip?: string }
}

interface MockSubscriber {
  id: number
  documentId: string
  email: string
  confirmationToken: string | null
  unsubscribeToken: string | null
  confirmed: boolean
  language: string
  createdAt: string
  updatedAt: string
}

interface MockFailures {
  pathOrder: boolean
  about: boolean
  site: boolean
  /** Comment writes and subscriber calls answer 429 with Retry-After, as the CMS limiter does */
  rateLimited: boolean
  /** The `Retry-After` those 429s carry */
  retryAfter: string
  /** Read paths (prefixes) that answer 429 as well; the rest of the API keeps working */
  rateLimitedReads: string[]
}

type MockModules = Record<'newsletter' | 'comments' | 'accounts' | 'drafts' | 'fediverse' | 'search' | 'support', boolean>

interface MockStrapiResult {
  server: Server
  url: string
  requests: RecordedRequest[]
  /** Reads of /api/site-setting, kept apart from `requests` */
  siteRequests: RecordedRequest[]
  failures: MockFailures
  /** The modules site-setting answers with; tests switch them off and back on */
  modules: MockModules
  /** The `theme` component site-setting answers with (null, as Strapi does when it was never saved) */
  theme: { value: unknown }
  /** The `homePage` relation site-setting answers with, by locale (null when never set) */
  homePage: { value: { en?: string, es?: string } | null }
  users: Array<{ id: number, username: string, email: string, password: string, confirmed: boolean, role: string }>
}

const author: StrapiAuthorRef = {
  id: 31,
  documentId: 'author-1',
  name: 'Alejandro Ramirez',
  avatar: null,
}

const coverVue: StrapiMediaRef = {
  id: 11,
  documentId: 'cover-vue',
  url: '/uploads/cover-vue.png',
  alternativeText: 'Vue cover',
  width: 1200,
  height: 630,
}

const coverLinux: StrapiMediaRef = {
  id: 12,
  documentId: 'cover-linux',
  url: '/uploads/cover-linux.png',
  alternativeText: 'Linux cover',
  width: 1200,
  height: 630,
}

const coverVueEs: StrapiMediaRef = {
  id: 13,
  documentId: 'cover-vue-es',
  url: '/uploads/cover-vue-es.png',
  alternativeText: 'Vue cover ES',
  width: 1200,
  height: 630,
}

const categoryVue: StrapiCategoryRef = {
  id: 21,
  documentId: 'cat-software',
  name: 'Desarrollo de software',
  slug: 'software',
}

const categoryLinux: StrapiCategoryRef = {
  id: 22,
  documentId: 'cat-linux',
  name: 'Linux y código abierto',
  slug: 'linux',
}

const emptyCategories: StrapiCategoryRef[] = [
  { id: 23, documentId: 'cat-privacidad', name: 'Privacidad', slug: 'privacidad' },
  { id: 24, documentId: 'cat-diy', name: 'DIY · Hazlo tú mismo', slug: 'diy' },
  { id: 25, documentId: 'cat-ia', name: 'Inteligencia artificial', slug: 'ia' },
  { id: 26, documentId: 'cat-tutorial', name: 'tutorial', slug: null },
]

const tagVue: StrapiTagRef = { id: 51, documentId: 'tag-vue', name: 'Vue', slug: 'vue' }
const tagTypeScript: StrapiTagRef = { id: 52, documentId: 'tag-typescript', name: 'TypeScript', slug: 'typescript' }
const tagLinux: StrapiTagRef = { id: 53, documentId: 'tag-linux', name: 'Linux', slug: 'linux' }
const tagDevOps: StrapiTagRef = { id: 54, documentId: 'tag-devops', name: 'DevOps', slug: 'devops' }
const tagVueEs: StrapiTagRef = { id: 55, documentId: 'tag-vue', name: 'Vue', slug: 'vue' }
const unusedTags: StrapiTagRef[] = [{ id: 56, documentId: 'tag-docker', name: 'Docker', slug: 'docker' }]

const seoVue: StrapiSEO = {
  id: 41,
  metaTitle: 'Vue Composables',
  metaDescription: 'Composables deep dive',
}

const seoLinux: StrapiSEO = {
  id: 42,
  metaTitle: 'Linux Server Hardening',
  metaDescription: 'Linux hardening guide',
}

const blockVue: StrapiRichText = {
  id: 1,
  __component: 'shared.rich-text',
  body: '## Getting Started\n\nComposables let you share stateful logic across components.',
}

const blockLinux: StrapiRichText = {
  id: 2,
  __component: 'shared.rich-text',
  body: '## Basics\n\nStart with SSH key authentication.',
}

const blockVueEs: StrapiRichText = {
  id: 3,
  __component: 'shared.rich-text',
  body: '## Primeros pasos\n\nLos composables permiten compartir lógica.',
}

const articles: RawStrapiArticle[] = [
  {
    id: 1,
    documentId: 'doc-vue',
    title: 'Understanding Vue Composables',
    slug: 'understanding-vue-composables',
    description: 'A deep dive into writing reusable Vue composables.',
    content: null,
    publishedAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    createdAt: '2026-01-20T10:00:00.000Z',
    locale: 'en',
    readTime: 8,
    tags: [tagVue, tagTypeScript, tagDevOps],
    cover: coverVue,
    category: categoryVue,
    author,
    seo: seoVue,
    blocks: [blockVue],
  },
  {
    id: 2,
    documentId: 'doc-linux',
    title: 'Linux Server Hardening Guide',
    slug: 'linux-server-hardening-guide',
    description: 'Practical steps to harden a Linux server.',
    content: null,
    publishedAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    createdAt: '2026-01-10T10:00:00.000Z',
    locale: 'en',
    readTime: 12,
    tags: [tagLinux, tagDevOps],
    cover: coverLinux,
    category: categoryLinux,
    author,
    seo: seoLinux,
    blocks: [blockLinux],
  },
  {
    id: 3,
    documentId: 'doc-vue-es',
    title: 'Guía de Vue Composables',
    slug: 'guia-vue-composables',
    description: 'Una guía profunda sobre composables de Vue.',
    content: null,
    publishedAt: '2026-02-02T10:00:00.000Z',
    updatedAt: '2026-02-02T10:00:00.000Z',
    createdAt: '2026-01-25T10:00:00.000Z',
    locale: 'es',
    readTime: 8,
    tags: [tagVueEs],
    cover: coverVueEs,
    category: categoryVue,
    author,
    seo: null,
    blocks: [blockVueEs],
  },
]

const localizations: Record<string, StrapiLocalization[]> = {
  'understanding-vue-composables': [{ id: 3, documentId: 'doc-vue', slug: 'guia-vue-composables', locale: 'es', publishedAt: '2026-02-02T10:00:00.000Z' }],
  'guia-vue-composables': [{ id: 1, documentId: 'doc-vue', slug: 'understanding-vue-composables', locale: 'en', publishedAt: '2026-02-01T10:00:00.000Z' }],
  'linux-server-hardening-guide': [{ id: 4, documentId: 'doc-linux', slug: 'guia-endurecer-servidor-linux', locale: 'es', publishedAt: null }],
}

const blogComment = {
  id: 201,
  documentId: 'comment-blog',
  content: 'Great introduction to composables.',
  blocked: false,
  blockedThread: false,
  removed: false,
  approvalStatus: 'APPROVED',
  isAdminComment: false,
  author: { id: 'guest-1', name: 'Ana Reader', email: 'ana@example.com' },
  createdAt: '2026-02-03T10:00:00.000Z',
  updatedAt: '2026-02-03T10:00:00.000Z',
  threadOf: null,
}

const fediverseComment = {
  id: 202,
  documentId: 'comment-fedi',
  content: 'Replied from Mastodon.',
  blocked: false,
  blockedThread: false,
  removed: false,
  approvalStatus: 'APPROVED',
  isAdminComment: false,
  author: { id: 'https://mastodon.social/users/bea', name: 'Bea', avatar: 'https://mastodon.social/bea.png' },
  createdAt: '2026-02-04T10:00:00.000Z',
  updatedAt: '2026-02-04T10:00:00.000Z',
  threadOf: null,
  fediverseActorHandle: '@bea@mastodon.social',
  fediverseUri: 'https://mastodon.social/users/bea/statuses/1',
}

const authorReply = {
  id: 203,
  documentId: 'comment-author',
  content: 'Thanks, Bea!',
  blocked: false,
  blockedThread: false,
  removed: false,
  approvalStatus: 'APPROVED',
  isAdminComment: true,
  author: { id: 1, name: 'Alejandro Ramirez', email: 'admin@example.com' },
  createdAt: '2026-02-05T10:00:00.000Z',
  updatedAt: '2026-02-05T10:00:00.000Z',
  threadOf: { id: 202 },
}

const pendingFediverseComment = {
  id: 204,
  documentId: 'comment-pending',
  content: 'Still waiting for review.',
  blocked: false,
  blockedThread: false,
  removed: false,
  approvalStatus: 'PENDING',
  isAdminComment: false,
  author: { id: 'https://fosstodon.org/users/carl', name: 'Carl' },
  createdAt: '2026-02-06T10:00:00.000Z',
  updatedAt: '2026-02-06T10:00:00.000Z',
  threadOf: null,
  fediverseActorHandle: '@carl@fosstodon.org',
  fediverseUri: 'https://fosstodon.org/users/carl/statuses/2',
}

const unsafeFediverseComment = {
  id: 205,
  documentId: 'comment-unsafe',
  content: '<script>alert(1)</script>',
  blocked: false,
  blockedThread: false,
  removed: false,
  approvalStatus: 'APPROVED',
  isAdminComment: false,
  author: { id: 'https://evil.example/users/eve', name: 'Eve' },
  createdAt: '2026-02-07T10:00:00.000Z',
  updatedAt: '2026-02-07T10:00:00.000Z',
  threadOf: null,
  fediverseActorHandle: '@eve@evil.example',
  fediverseUri: 'javascript:alert(1)',
}

const rejectedComment = {
  ...blogComment,
  id: 206,
  documentId: 'comment-rejected',
  content: 'Spam.',
  approvalStatus: 'REJECTED',
}

const spanishComment = {
  ...blogComment,
  id: 208,
  documentId: 'comment-es',
  content: 'Muy buena introducción.',
  author: { id: 'guest-2', name: 'Luis', email: 'luis@example.com' },
}

const flatComments = [blogComment, fediverseComment, authorReply, pendingFediverseComment, unsafeFediverseComment, rejectedComment]

const hierarchyComments = [
  { ...blogComment, children: [] },
  { ...fediverseComment, children: [authorReply, { ...pendingFediverseComment, threadOf: { id: 202 }, children: [] }] },
  { ...pendingFediverseComment, children: [authorReply] },
]

let nextSubscriberId = 7

const subscribers: MockSubscriber[] = [
  {
    id: 5,
    documentId: 'sub-confirmed',
    email: 'confirmed@example.com',
    confirmationToken: null,
    unsubscribeToken: 'unsubscribe-token-confirmed-0001',
    confirmed: true,
    language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 6,
    documentId: 'sub-pending',
    email: 'pending@example.com',
    confirmationToken: 'confirmation-token-pending-0001',
    unsubscribeToken: 'unsubscribe-token-pending-0001',
    confirmed: false,
    language: 'es',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 3,
    documentId: 'sub-to-confirm',
    email: 'to-confirm@example.com',
    confirmationToken: 'confirmation-token-to-confirm-0001',
    unsubscribeToken: null,
    confirmed: false,
    language: 'es',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 4,
    documentId: 'sub-leaving',
    email: 'leaving@example.com',
    confirmationToken: null,
    unsubscribeToken: 'unsubscribe-token-leaving-0001',
    confirmed: true,
    language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    documentId: 'sub-one-click',
    email: 'one-click@example.com',
    confirmationToken: null,
    unsubscribeToken: 'unsubscribe-token-one-click-0001',
    confirmed: true,
    language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

function getNestedValue(obj: unknown, path: string[]): unknown {
  let current = obj
  for (const key of path) {
    if (typeof current === 'object' && current !== null && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as Record<string, unknown>)
      } catch {
        resolve({})
      }
    })
  })
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function sendPng(res: ServerResponse): void {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  )
  res.writeHead(200, { 'Content-Type': 'image/png' })
  res.end(png)
}

function recordRequest(
  requests: RecordedRequest[],
  method: string,
  path: string,
  query: Record<string, unknown>,
  body: Record<string, unknown> | undefined,
): void {
  const recorded: RecordedRequest = { method, path, query }
  if (body && typeof body === 'object') recorded.rawBody = body
  if (body && typeof body === 'object' && 'data' in body) {
    recorded.body = { data: body.data as Record<string, unknown> }
  }
  if (body && typeof body === 'object' && 'locale' in body) {
    recorded.body = { ...recorded.body, locale: body.locale }
  }
  requests.push(recorded)
}

export async function startMockStrapi(): Promise<MockStrapiResult> {
  const requests: RecordedRequest[] = []
  const siteRequests: RecordedRequest[] = []
  const failures: MockFailures = { pathOrder: false, about: false, site: false, rateLimited: false, retryAfter: '42', rateLimitedReads: [] }
  const modules: MockModules = { newsletter: true, comments: true, accounts: true, drafts: true, fediverse: true, search: true, support: true }
  const theme = { value: null as unknown }
  const homePage: MockStrapiResult['homePage'] = { value: null }
  const authMock = createAuthMock({ frontendUrl: 'https://bogdev.test' })
  const draftsMock = createDraftsMock({ userFromAuth: authMock.userFromAuth, publishedArticles: articles })

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method || 'GET'
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const query = qs.parse(url.searchParams.toString(), { depth: 20 })
    const body = ['POST', 'PUT', 'DELETE'].includes(method) ? await readJsonBody(req) : undefined

    // site-setting is read before every module route, so it goes to its own list
    const log = url.pathname === '/api/site-setting' ? siteRequests : requests
    recordRequest(log, method, url.pathname, query, body)
    if (req.headers.authorization) log[log.length - 1]!.authorization = req.headers.authorization

    const secret = req.headers['x-micelio-forwarder-secret']
    const ip = req.headers['x-micelio-client-ip']
    if (secret || ip) log[log.length - 1]!.forwarder = { secret: String(secret ?? ''), ip: String(ip ?? '') }

    const limitedPath = (method === 'POST' && url.pathname.startsWith('/api/comments/')) || url.pathname.startsWith('/api/subscribers') || (method === 'POST' && url.pathname.startsWith('/api/auth/'))
    const limitedRead = method === 'GET' && failures.rateLimitedReads.some(prefix => url.pathname.startsWith(prefix))
    if ((failures.rateLimited && limitedPath) || limitedRead) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': failures.retryAfter })
      res.end(JSON.stringify({ data: null, error: { status: 429, name: 'RateLimitError', message: 'Too many requests, please try again later.', details: {} } }))
      return
    }

    const auth = authMock.handle(method, url.pathname, query, body, req.headers)
    if (auth) {
      res.writeHead(auth.status, auth.headers ?? { 'Content-Type': 'application/json' })
      res.end(auth.headers ? undefined : JSON.stringify(auth.body))
      return
    }

    const drafts = draftsMock.handle(method, url.pathname, query, req.headers)
    if (drafts) {
      sendJson(res, drafts.status, drafts.body)
      return
    }

    if (method === 'GET' && url.pathname === '/api/articles/search') {
      const term = String(query.q ?? '').toLowerCase()
      if (term === 'fail-search') {
        sendJson(res, 500, { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } })
        return
      }
      const content = query.content === '1'
      const plainTexts: Record<string, string> = {
        'doc-vue': 'Composables share state with the rest of the app.',
        'doc-linux': 'Start with SSH key authentication.',
        'doc-vue-es': 'Los composables comparten estado con la app.',
      }
      const data = articles
        .filter(article => !query.locale || article.locale === query.locale)
        .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
        .flatMap((article) => {
          const fields = [['title', article.title], ...(content ? [['description', article.description ?? ''], ['content', plainTexts[article.documentId] ?? '']] : [])]
          const hit = fields.find(([, value]) => value!.toLowerCase().includes(term))
          if (!hit) return []
          return [{
            documentId: article.documentId,
            slug: article.slug,
            title: article.title,
            description: article.description,
            publishedAt: article.publishedAt,
            locale: article.locale,
            category: article.category ? { slug: article.category.slug, name: article.category.name } : null,
            matchedIn: hit[0],
            snippet: hit[1],
          }]
        })
        .slice(0, Number(query.limit || 10))
      sendJson(res, 200, { data, meta: { query: term, count: data.length } })
      return
    }

    if (method === 'GET' && url.pathname === '/api/articles') {
      const slugFilter = getNestedValue(query, ['filters', 'slug', '$eq']) as string | undefined
      const titleFilter = getNestedValue(query, ['filters', 'title', '$containsi']) as string | undefined
      const localeFilter = query.locale as string | undefined
      const categoryFilter = getNestedValue(query, ['filters', 'category', 'slug', '$eq']) as string | undefined
      const tagFilter = getNestedValue(query, ['filters', 'tags', 'slug', '$eq']) as string | undefined
      const documentIdFilter = getNestedValue(query, ['filters', 'documentId', '$in']) as string[] | undefined
      const pathFilter = getNestedValue(query, ['filters', 'pathOrder', '$notNull'])
      const sorts = ([] as unknown[]).concat(query.sort ?? [])
      const ascending = sorts[0] === 'publishedAt:asc'
      const byPath = sorts[0] === 'pathOrder:asc'
      const pathOrders: Record<string, number> = { 'doc-linux': 1, 'doc-vue': 2 }
      const page = Number(getNestedValue(query, ['pagination', 'page']) || 1)
      const pageSize = Number(getNestedValue(query, ['pagination', 'pageSize']) || 10)
      const populated = (article: RawStrapiArticle): RawStrapiArticle => {
        const { tags, ...rest } = article
        const withTags = getNestedValue(query, ['populate', 'tags']) === undefined ? rest : { ...rest, tags }
        if (getNestedValue(query, ['populate', 'localizations']) === undefined) return withTags
        return { ...withTags, localizations: localizations[article.slug] ?? [] }
      }

      if (getNestedValue(query, ['filters', 'tags']) !== undefined && !tagFilter) {
        sendJson(res, 400, { data: null, error: { status: 400, name: 'ValidationError', message: 'Invalid key tags' } })
        return
      }

      if (slugFilter === 'broken-article') {
        sendJson(res, 500, { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } })
        return
      }

      if (slugFilter) {
        const data = articles.map(populated).filter((article) => {
          const matchesSlug = article.slug === slugFilter
          const matchesLocale = localeFilter ? article.locale === localeFilter : true
          return matchesSlug && matchesLocale
        })
        sendJson(res, 200, { data })
        return
      }

      let data = articles.map(populated)
      if (localeFilter) {
        data = data.filter(article => article.locale === localeFilter)
      }
      if (categoryFilter) {
        data = data.filter(article => article.category?.slug === categoryFilter)
      }
      if (titleFilter) {
        const term = titleFilter.toLowerCase()
        data = data.filter(article => article.title.toLowerCase().includes(term))
      }
      if (tagFilter) {
        data = data.filter(article => article.tags?.some(tag => tag.slug === tagFilter))
      }
      if (documentIdFilter) {
        data = data.filter(article => documentIdFilter.includes(article.documentId))
      }
      if (pathFilter) {
        if (failures.pathOrder) {
          sendJson(res, 400, { data: null, error: { status: 400, name: 'ValidationError', message: 'Invalid key pathOrder' } })
          return
        }
        data = data.filter(article => pathOrders[article.documentId] !== undefined)
      }
      data.sort((a, b) => {
        if (byPath) return (pathOrders[a.documentId] ?? 0) - (pathOrders[b.documentId] ?? 0)
        const dateA = new Date(a.publishedAt || 0).getTime()
        const dateB = new Date(b.publishedAt || 0).getTime()
        return ascending ? dateA - dateB : dateB - dateA
      })

      const total = data.length
      const pageCount = Math.ceil(total / pageSize)
      const start = (page - 1) * pageSize
      const pageItems = data.slice(start, start + pageSize)

      sendJson(res, 200, {
        data: pageItems,
        meta: { pagination: { total, page, pageSize, pageCount } },
      })
      return
    }

    if (method === 'GET' && url.pathname === '/api/tags') {
      const locale = (query.locale as string | undefined) ?? 'en'
      const localized = articles.filter(article => article.locale === locale)
      const tags = new Map<string, StrapiTagRef>()
      for (const tag of localized.flatMap(article => article.tags ?? [])) tags.set(tag.slug, tag)
      const data = [...tags.values(), ...unusedTags].map(tag => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        articles: localized.filter(article => article.tags?.some(own => own.slug === tag.slug)).map(article => ({ id: article.id })),
      }))
      sendJson(res, 200, { data })
      return
    }

    if (method === 'GET' && url.pathname === '/api/categories') {
      const localeFilter = getNestedValue(query, ['populate', 'articles', 'filters', 'locale', '$eq']) as string | undefined ?? 'en'
      const categories = [categoryVue, categoryLinux, ...emptyCategories].map(category => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        articles: articles
          .filter(article => article.category?.slug === category.slug && article.locale === localeFilter)
          .map(article => ({ id: article.id })),
      }))
      sendJson(res, 200, { data: categories })
      return
    }

    if (method === 'GET' && url.pathname === '/api/site-setting') {
      if (failures.site) {
        sendJson(res, 500, { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } })
        return
      }
      const locale = (query.locale as string | undefined) ?? 'en'
      sendJson(res, 200, {
        data: {
          id: 1,
          documentId: 'site',
          locale,
          name: 'Micelio',
          description: locale === 'es' ? 'Un motor de blogs' : '',
          url: 'https://micelio.test',
          defaultLocale: 'en',
          author: { id: 1, name: 'Grace', url: null },
          logo: { id: 9, url: '/uploads/logo.svg', alternativeText: 'Micelio', width: 120, height: 40 },
          favicon: null,
          defaultOgImage: null,
          socialLinks: [{ id: 1, network: 'codeberg', url: 'https://codeberg.org/micelio' }],
          contactEmail: 'hola@micelio.test',
          privacyContactEmail: null,
          privacyUpdatedAt: null,
          supportHandle: null,
          modules: { id: 1, ...modules },
          theme: theme.value,
          homePage: homePage.value?.[locale as 'en' | 'es'] ? { id: 1, documentId: 'home-page', slug: homePage.value[locale as 'en' | 'es'] } : null,
        },
      })
      return
    }

    if (method === 'GET' && url.pathname === '/api/pages') {
      const result = findPages(query, getNestedValue)
      sendJson(res, result.status, result.body)
      return
    }

    if (method === 'GET' && url.pathname === '/api/about') {
      if (failures.about) {
        sendJson(res, 400, {
          data: null,
          error: { status: 400, name: 'ValidationError', message: 'Invalid key about.profile at blocks.on.about.profile' },
        })
        return
      }
      const locale = (query.locale as string | undefined) ?? 'en'
      sendJson(res, 200, {
        data: {
          id: 1,
          documentId: 'about',
          locale,
          blocks: [{ id: 1, __component: 'shared.hero', title: 'About BogDev', subtitle: 'Personal blog' }],
          seo: null,
        },
      })
      return
    }

    if (method === 'GET' && url.pathname === '/api/fediverse/articles/ranking') {
      if (query.search === 'fail') {
        sendJson(res, 500, { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } })
        return
      }
      const scores: Record<string, number> = { 'doc-linux': 5, 'doc-vue-es': 3, 'doc-vue': 1 }
      const locale = (query.locale as string | undefined) ?? 'en'
      const term = typeof query.search === 'string' ? query.search.toLowerCase() : ''
      const ranked = articles
        .filter(article => article.locale === locale)
        .filter(article => !query.category || article.category?.slug === query.category)
        .filter(article => !query.tag || article.tags?.some(tag => tag.slug === query.tag))
        .filter(article => !term || article.title.toLowerCase().includes(term))
        .sort((a, b) => (scores[b.documentId] ?? 0) - (scores[a.documentId] ?? 0))
      const page = Number(query.page || 1)
      const pageSize = Number(query.pageSize || 6)
      sendJson(res, 200, {
        data: ranked.slice((page - 1) * pageSize, page * pageSize).map(article => ({
          documentId: article.documentId,
          likes: scores[article.documentId] ?? 0,
          boosts: 0,
          replies: 0,
        })),
        meta: { pagination: { page, pageSize, pageCount: Math.ceil(ranked.length / pageSize), total: ranked.length } },
      })
      return
    }

    if (method === 'GET' && url.pathname === '/api/fediverse/articles/stats') {
      const ids = String(query.documentIds ?? '').split(',')
      if (ids.includes('doc-broken')) {
        sendJson(res, 500, { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } })
        return
      }
      const known: Record<string, { likes: number, boosts: number, replies: number }> = {
        'doc-vue-es': { likes: 4, boosts: 2, replies: 1 },
        'doc-linux': { likes: 0, boosts: 1, replies: 0 },
      }
      sendJson(res, 200, Object.fromEntries(ids.filter(id => known[id]).map(id => [id, known[id]])))
      return
    }

    const fediverseStats = url.pathname.match(/^\/api\/fediverse\/articles\/([^/]+)\/stats$/)
    if (method === 'GET' && fediverseStats) {
      const documentId = fediverseStats[1]
      if (documentId === 'doc-broken') {
        sendJson(res, 500, { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } })
        return
      }
      if (documentId !== 'doc-vue-es') {
        sendJson(res, 404, { data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found' } })
        return
      }
      sendJson(res, 200, { likes: 4, boosts: 2 })
      return
    }

    if (method === 'GET' && url.pathname === '/api/comments') {
      sendJson(res, 200, { data: [] })
      return
    }

    if (method === 'GET' && url.pathname === '/api/comments/api::article.article:doc-vue/flat') {
      const data = query.locale === 'es' ? [spanishComment] : flatComments
      sendJson(res, 200, { data, pagination: { page: 1, pageSize: 10, pageCount: 1, total: data.length } })
      return
    }

    if (method === 'GET' && url.pathname === '/api/comments/api::article.article:doc-vue') {
      sendJson(res, 200, hierarchyComments)
      return
    }

    if (method === 'POST' && url.pathname === '/api/comments/api::article.article:doc-vue') {
      const author = (body?.author ?? {}) as Record<string, unknown>
      sendJson(res, 200, {
        ...blogComment,
        id: 207,
        documentId: 'comment-new',
        content: String(body?.content ?? ''),
        author: { id: author.id, name: author.name, email: author.email },
      })
      return
    }

    if (method === 'GET' && url.pathname === '/api/subscribers') {
      const fields = ['email', 'confirmationToken', 'unsubscribeToken'] as const
      const field = fields.find(name => getNestedValue(query, ['filters', name, '$eq']) !== undefined)
      const value = field ? getNestedValue(query, ['filters', field, '$eq']) : undefined
      const data = field ? subscribers.filter(subscriber => subscriber[field] === value) : []
      sendJson(res, 200, { data })
      return
    }

    if (method === 'PUT' && url.pathname.startsWith('/api/subscribers/')) {
      const documentId = url.pathname.split('/').pop()
      const subscriber = subscribers.find(entry => entry.documentId === documentId)
      if (!subscriber) {
        sendJson(res, 404, { error: { status: 404, message: 'Not Found' } })
        return
      }
      Object.assign(subscriber, body?.data ?? {}, { updatedAt: new Date().toISOString() })
      sendJson(res, 200, { data: subscriber })
      return
    }

    if (method === 'POST' && url.pathname === '/api/subscribers') {
      const data = body?.data ?? {}
      const now = new Date().toISOString()
      const id = nextSubscriberId++
      const newSubscriber: MockSubscriber = {
        id,
        documentId: `sub-${id}`,
        email: String(data.email || ''),
        confirmationToken: data.confirmationToken ?? null,
        unsubscribeToken: data.unsubscribeToken ?? null,
        confirmed: Boolean(data.confirmed),
        language: String(data.language || 'en'),
        createdAt: now,
        updatedAt: now,
      }
      subscribers.push(newSubscriber)
      sendJson(res, 201, { data: newSubscriber })
      return
    }

    if (method === 'DELETE' && url.pathname.startsWith('/api/subscribers/')) {
      const documentId = url.pathname.split('/').pop()
      const index = subscribers.findIndex(subscriber => subscriber.documentId === documentId)
      if (index !== -1) {
        subscribers.splice(index, 1)
      }
      sendJson(res, 200, { data: {} })
      return
    }

    if (method === 'GET' && url.pathname.startsWith('/uploads/')) {
      if (url.pathname.endsWith('.glb')) {
        res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Access-Control-Allow-Origin': '*' })
        res.end(triangleGlb())
        return
      }
      sendPng(res)
      return
    }

    sendJson(res, 404, { error: { status: 404, message: 'Not found' } })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      resolve({ server, url: `http://127.0.0.1:${port}`, requests, siteRequests, failures, modules, theme, homePage, users: authMock.users })
    })
  })
}
