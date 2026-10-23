import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { join } from 'node:path'
import sanitizeHtml from 'sanitize-html'
import { z } from 'zod'
import { $fetch as typedFetch, fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import type { FetchOptions } from 'ofetch'
import type { RawStrapiArticle } from '~/interfaces/strapi-post'
import type { Page, PageSection } from '~/interfaces/page'
import type { StrapiRichText } from '~/interfaces/strapi-blocks'
import { HASHED_TOKENS, startMockStrapi, WEBFINGER_JRD } from './mock-strapi'
import { MOCK_REDIRECT_TARGET, MOCK_TRACKER_SCRIPT, startMockUmami } from './mock-umami'
import { confirmationToken, resetCode, testUsers } from '../../e2e/fixtures/auth.mjs'
import { pageFixtures } from '../../e2e/fixtures/pages.mjs'
import { aboutSchema } from '~/schemas/blocks'
import { commentSchema, commentsResponseSchema, commentTreeSchema } from '~/schemas/comments'
import { draftListResponseSchema } from '~/schemas/drafts'
import { pageSchema } from '~/schemas/pages'
import { siteSchema } from '~/schemas/site'
import { articlePageSchema, articleSchema, categoryCountSchema, draftArticleResponseSchema, readingPathSchema, searchResultSchema } from '~/schemas/posts'
import { contrastRatio, parseHex } from '~/helpers/color'
import { inlineScripts } from '~/helpers/securityHeaders'

const SITE_URL = 'https://bogdev.test'

/** `$fetch` without the typed Nitro routes, whose type instantiation passes the compiler's depth limit in a file this long. */
const $fetch = typedFetch as <T = unknown>(request: string, options?: FetchOptions) => Promise<T>

const mock = await startMockStrapi()
const umami = await startMockUmami()
process.env.NUXT_PUBLIC_STRAPI_URL = mock.url
process.env.NUXT_SMTP_PORT = '1'
// A full SMTP setting keeps the newsletter module on; port 1 makes every send fail fast
process.env.NUXT_SMTP_HOST = '127.0.0.1'
process.env.NUXT_SMTP_USER = 'test'
process.env.NUXT_SMTP_PASS = 'test'
process.env.NUXT_NEWSLETTER_FROM = 'BogDev <no-reply@bogdev.test>'
process.env.NUXT_STRAPI_API_TOKEN = 'test-api-token'
const FORWARDER_SECRET = 'forwarder-secret-0123456789-abcdefghij'
process.env.NUXT_STRAPI_FORWARDER_SECRET = FORWARDER_SECRET
process.env.NUXT_PUBLIC_SITE_URL = SITE_URL
// Module switches must take effect at once in these tests
process.env.NUXT_SITE_CACHE_SECONDS = '0'
process.env.NUXT_MEDIA_URL = 'https://resources.bogdev.com.co'
process.env.NUXT_PUBLIC_FEDIVERSE_HANDLE = '@bogdev@api.bogdev.com.co'
process.env.NUXT_PUBLIC_FEDIVERSE_ACTOR_URL = 'https://api.bogdev.com.co/fediverse/user/devbog'
process.env.NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL = 'https://api.bogdev.com.co/fediverse/articles'
process.env.NUXT_UMAMI_URL = umami.url
process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID = 'site-1'

await setup({
  server: true,
  setupTimeout: 600_000,
  nuxtConfig: {
    nitro: { prerender: { crawlLinks: false } },
  },
})

beforeEach(() => {
  mock.requests.length = 0
  mock.siteRequests.length = 0
  mock.failures.pathOrder = false
  mock.failures.about = false
  mock.failures.site = false
  mock.failures.categories = false
  mock.failures.broken = ''
  mock.failures.webfinger = ''
  mock.webfingerHeaders.value = null
  mock.theme.value = null
  mock.homePage.value = null
  mock.securityContact.value = null
  for (const module of Object.keys(mock.modules) as (keyof typeof mock.modules)[]) mock.modules[module] = true
  umami.requests.length = 0
})

/** The CMS route that finds a subscriber by a request body. */
const LOOKUP_PATH = '/api/subscribers/lookup'

// Nitro caches the category list for ten minutes per locale and a failure is never stored. The server reads the English list while it boots,
// so these tests use the Spanish one, which nothing has read yet: they must stay before every other test that asks for Spanish categories
describe('when the CMS cannot list the categories', () => {
  it('does not guess a redirect for a legacy filter: without the list a category cannot be told from a tag', async () => {
    mock.failures.categories = true
    const response = await fetch('/es/blog?category=linux', { redirect: 'manual' })
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('answers 502 for the category list and the category feed, and stores nothing', async () => {
    mock.failures.categories = true
    await expect($fetch('/api/categories', { query: { locale: 'es' } })).rejects.toMatchObject({ response: { status: 502 } })
    expect((await fetch('/es/feed/linux.xml')).status).toBe(502)
  })

  it('serves the list again once the CMS recovers', async () => {
    const result = await $fetch<unknown[]>('/api/categories', { query: { locale: 'es' } })
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('/api/categories', () => {
  it('returns the categories of the CMS by order, whatever their slugs, and hides those without a slug', async () => {
    const result = await $fetch<Array<{ slug: string | null, name: string, count: number, featured: boolean, color: number | null }>>('/api/categories', { query: { locale: 'en' } })
    expect(result.map(category => [category.slug, category.count])).toEqual([
      ['privacidad', 0],
      ['diy', 0],
      ['ia', 0],
      ['software', 1],
      ['linux', 1],
      ['garden', 0],
      ['kitchen', 0],
    ])
    expect(Object.keys(result[0]!).sort()).toEqual(['color', 'count', 'description', 'featured', 'id', 'name', 'order', 'slug'])
    expect(result.map(category => [category.slug, category.featured, category.color])).toEqual([
      ['privacidad', true, null], ['diy', true, null], ['ia', false, null], ['software', false, 2], ['linux', false, null], ['garden', false, null], ['kitchen', false, null],
    ])
    expect(z.array(categoryCountSchema).safeParse(result).error?.issues ?? []).toEqual([])
  })

  it('counts articles of the requested locale only', async () => {
    const result = await $fetch<Array<{ slug: string | null, count: number }>>('/api/categories', { query: { locale: 'es' } })
    expect(result.find(category => category.slug === 'software')?.count).toBe(1)
    expect(result.find(category => category.slug === 'linux')?.count).toBe(0)
  })

  it('names each category in the requested locale and falls back to the slug when it has no translation', async () => {
    const english = await $fetch<Array<{ slug: string, name: string }>>('/api/categories', { query: { locale: 'en' } })
    expect(english.find(category => category.slug === 'linux')?.name).toBe('Linux and open source')
    expect(english.find(category => category.slug === 'kitchen')?.name).toBe('Kitchen')
    const spanish = await $fetch<Array<{ slug: string, name: string }>>('/api/categories', { query: { locale: 'es' } })
    expect(spanish.find(category => category.slug === 'linux')?.name).toBe('Linux y código abierto')
    expect(spanish.find(category => category.slug === 'garden')?.name).toBe('Jardín')
    expect(spanish.find(category => category.slug === 'kitchen')?.name).toBe('kitchen')
    // Every category of the default locale stays in the list, in its order; one that exists only in Spanish is added at the end
    expect(english.map(category => category.slug)).not.toContain('invierno')
    expect(spanish.map(category => category.slug)).toEqual([...english.map(category => category.slug), 'invierno'])
  })
})

describe('/api/posts category filter', () => {
  it('filters by category slug', async () => {
    const result = await $fetch<{ data: Array<{ slug: string }> }>('/api/posts', { query: { locale: 'en', category: 'linux' } })
    expect(result.data.map(post => post.slug)).toEqual(['linux-server-hardening-guide'])
    const strapiRequests = mock.requests.filter(request => request.method === 'GET' && request.path === '/api/articles')
    expect(getNestedValue(strapiRequests.at(-1)!.query, ['filters', 'category', 'slug', '$eq'])).toBe('linux')
  })
})

describe('/api/tags', () => {
  it('returns the tags used in the locale, most used first, and hides unused ones', async () => {
    const result = await $fetch<Array<{ slug: string, name: string, count: number }>>('/api/tags', { query: { locale: 'en' } })
    expect(result).toEqual([
      { slug: 'devops', name: 'DevOps', count: 2 },
      { slug: 'linux', name: 'Linux', count: 1 },
      { slug: 'typescript', name: 'TypeScript', count: 1 },
      { slug: 'vue', name: 'Vue', count: 1 },
    ])
    const upstream = mock.requests.find(request => request.path === '/api/tags')
    expect(upstream?.query).toMatchObject({ locale: 'en', fields: ['name', 'slug'] })
  })

  it('counts articles of the requested locale only', async () => {
    const result = await $fetch<Array<{ slug: string, count: number }>>('/api/tags', { query: { locale: 'es' } })
    expect(result).toEqual([{ slug: 'vue', name: 'Vue', count: 1 }])
  })
})

describe('/api/posts tag filter', () => {
  it('filters by the tag relation and returns each article with its tags', async () => {
    const result = await $fetch<{ data: RawStrapiArticle[] }>('/api/posts', { query: { locale: 'en', tag: 'devops' } })
    expect(result.data.map(post => post.slug)).toEqual(['understanding-vue-composables', 'linux-server-hardening-guide'])
    expect(result.data[1]?.tags).toEqual([
      { id: 53, documentId: 'tag-linux', name: 'Linux', slug: 'linux' },
      { id: 54, documentId: 'tag-devops', name: 'DevOps', slug: 'devops' },
    ])
    const upstream = mock.requests.filter(request => request.path === '/api/articles').at(-1)!
    expect(getNestedValue(upstream.query, ['filters', 'tags', 'slug', '$eq'])).toBe('devops')
    expect(getNestedValue(upstream.query, ['populate', 'tags', 'fields'])).toEqual(['name', 'slug'])
  })

  it('returns an empty page for a tag no article has', async () => {
    const result = await $fetch<{ data: RawStrapiArticle[] }>('/api/posts', { query: { locale: 'en', tag: 'docker' } })
    expect(result.data).toEqual([])
  })
})

describe('/api/posts sort', () => {
  type PostsPage = { data: Array<{ documentId: string }>, meta: { pagination: { page: number, pageSize: number, total: number, pageCount: number } } }
  const ids = (response: PostsPage) => response.data.map(post => post.documentId)

  it('sorts by newest first by default and for unknown values', async () => {
    expect(ids(await $fetch<PostsPage>('/api/posts', { query: { locale: 'en' } }))).toEqual(['doc-vue', 'doc-linux'])
    expect(ids(await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', sort: 'recent' } }))).toEqual(['doc-vue', 'doc-linux'])
    expect(ids(await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', sort: 'popular' } }))).toEqual(['doc-vue', 'doc-linux'])
    const upstream = mock.requests.filter(request => request.path === '/api/articles')
    expect(upstream.every(request => request.query.sort === 'publishedAt:desc')).toBe(true)
  })

  it('sorts by oldest first', async () => {
    const response = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', sort: 'oldest' } })
    expect(ids(response)).toEqual(['doc-linux', 'doc-vue'])
    expect(mock.requests.find(request => request.path === '/api/articles')?.query.sort).toBe('publishedAt:asc')
  })

  it('sorts by fediverse conversation with the backend ranking, page by page', async () => {
    const first = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', sort: 'fediverse', page: 1, pageSize: 1 } })
    const second = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', sort: 'fediverse', page: 2, pageSize: 1 } })
    expect(ids(first)).toEqual(['doc-linux'])
    expect(ids(second)).toEqual(['doc-vue'])
    expect(second.meta.pagination).toEqual({ page: 2, pageSize: 1, pageCount: 2, total: 2 })

    const ranking = mock.requests.filter(request => request.path === '/api/fediverse/articles/ranking')
    expect(ranking.map(request => request.query)).toEqual([
      { page: '1', pageSize: '1', locale: 'en' },
      { page: '2', pageSize: '1', locale: 'en' },
    ])
  })

  it('passes the category and search filters to the ranking', async () => {
    const response = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', sort: 'fediverse', category: 'software', search: 'vue' } })
    expect(ids(response)).toEqual(['doc-vue'])
    const ranking = mock.requests.find(request => request.path === '/api/fediverse/articles/ranking')
    expect(ranking?.query).toMatchObject({ category: 'software', search: 'vue' })
  })

  it('passes the tag to the ranking', async () => {
    const response = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', sort: 'fediverse', tag: 'vue' } })
    expect(ids(response)).toEqual(['doc-vue'])
    const ranking = mock.requests.find(request => request.path === '/api/fediverse/articles/ranking')
    expect(ranking?.query).toMatchObject({ tag: 'vue' })
  })

  it('falls back to newest first when the ranking fails', async () => {
    const response = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', sort: 'fediverse', search: 'fail' } })
    expect(response.data).toEqual([])
    expect(mock.requests.find(request => request.path === '/api/articles')?.query.sort).toBe('publishedAt:desc')
  })
})

describe('content search', () => {
  type PostsPage = { data: Array<{ documentId: string, snippet?: string | null }>, meta: { pagination: { total: number } } }

  it('searches only titles by default', async () => {
    expect(await $fetch('/api/search', { query: { q: 'ssh', locale: 'en' } })).toEqual([])
    const upstream = mock.requests.find(request => request.path === '/api/articles/search')
    expect(upstream?.query).toEqual({ q: 'ssh', locale: 'en', limit: '10' })
  })

  it('also searches descriptions and bodies with content=1 and returns the snippet', async () => {
    const results = await $fetch<Array<Record<string, unknown>>>('/api/search', { query: { q: 'ssh', locale: 'en', content: '1' } })
    expect(results).toEqual([{
      documentId: 'doc-linux',
      slug: 'linux-server-hardening-guide',
      title: 'Linux Server Hardening Guide',
      description: expect.any(String),
      publishedAt: '2026-01-15T10:00:00.000Z',
      category: { slug: 'linux', name: 'Linux y código abierto' },
      matchedIn: 'content',
      snippet: 'Start with SSH key authentication.',
    }])
    expect(mock.requests.find(request => request.path === '/api/articles/search')?.query).toMatchObject({ content: '1' })
  })

  it('does not call the backend for short queries', async () => {
    expect(await $fetch('/api/search', { query: { q: 'ss', content: '1' } })).toEqual([])
    expect(mock.requests.some(request => request.path === '/api/articles/search')).toBe(false)
  })

  it('lists the blog posts whose body matches, with the snippet', async () => {
    const response = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', search: 'ssh', content: '1' } })
    expect(response.data.map(post => post.documentId)).toEqual(['doc-linux'])
    expect(response.data[0]?.snippet).toBe('Start with SSH key authentication.')
    const articles = mock.requests.find(request => request.path === '/api/articles')
    expect(articles?.query.filters).toEqual({ slug: { $notNull: 'true' }, documentId: { $in: ['doc-linux'] } })

    const titlesOnly = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', search: 'ssh' } })
    expect(titlesOnly.data).toEqual([])
  })

  it('keeps the category filter and the sort with content search', async () => {
    const recent = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', search: 'with', content: '1' } })
    expect(recent.data.map(post => post.documentId)).toEqual(['doc-vue', 'doc-linux'])

    const oldest = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', search: 'with', content: '1', sort: 'oldest' } })
    expect(oldest.data.map(post => post.documentId)).toEqual(['doc-linux', 'doc-vue'])

    const fediverse = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', search: 'with', content: '1', sort: 'fediverse', pageSize: 1, page: 2 } })
    expect(fediverse.data.map(post => post.documentId)).toEqual(['doc-vue'])
    expect(fediverse.meta.pagination.total).toBe(2)

    const linux = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', search: 'with', content: '1', category: 'linux' } })
    expect(linux.data.map(post => post.documentId)).toEqual(['doc-linux'])
  })

  it('returns an empty page when nothing matches', async () => {
    const response = await $fetch<PostsPage>('/api/posts', { query: { locale: 'en', search: 'kubernetes', content: '1' } })
    expect(response.data).toEqual([])
    expect(response.meta.pagination.total).toBe(0)
    expect(mock.requests.some(request => request.path === '/api/articles')).toBe(false)
  })
})

describe('/api/posts search', () => {
  it('filters titles from three letters on and combines with the category', async () => {
    const result = await $fetch<{ data: Array<{ slug: string }> }>('/api/posts', { query: { locale: 'en', search: 'vue', category: 'software' } })
    expect(result.data.map(post => post.slug)).toEqual(['understanding-vue-composables'])
    const strapiRequests = mock.requests.filter(request => request.method === 'GET' && request.path === '/api/articles')
    expect(getNestedValue(strapiRequests.at(-1)!.query, ['filters', 'title', '$containsi'])).toBe('vue')
  })

  it('ignores searches shorter than three letters', async () => {
    await $fetch('/api/posts', { query: { locale: 'en', search: 'vu' } })
    const strapiRequests = mock.requests.filter(request => request.method === 'GET' && request.path === '/api/articles')
    expect(getNestedValue(strapiRequests.at(-1)!.query, ['filters', 'title', '$containsi'])).toBeUndefined()
  })
})

describe('/api/reading-path', () => {
  it('follows the editorial pathOrder of the category', async () => {
    const path = await $fetch('/api/reading-path', { query: { category: 'linux', locale: 'en' } })
    expect(path).toEqual({
      category: 'linux',
      editorial: true,
      steps: [{ documentId: 'doc-linux', slug: 'linux-server-hardening-guide', title: 'Linux Server Hardening Guide' }],
    })
    const request = mock.requests.find(item => item.path === '/api/articles')
    expect(request?.query).toMatchObject({
      filters: { category: { slug: { $eq: 'linux' } }, pathOrder: { $notNull: 'true' } },
      sort: ['pathOrder:asc', 'publishedAt:asc'],
      locale: 'en',
    })
  })

  it('falls back to publication date when no article of the category has a pathOrder', async () => {
    const path = await $fetch<{ editorial: boolean, steps: Array<{ documentId: string }> }>('/api/reading-path', { query: { category: 'software', locale: 'es' } })
    expect(path.editorial).toBe(false)
    expect(path.steps.map(step => step.documentId)).toEqual(['doc-vue-es'])
    expect(mock.requests.filter(item => item.path === '/api/articles').at(-1)?.query.sort).toBe('publishedAt:asc')
  })

  it('falls back to publication date when Strapi does not know pathOrder yet', async () => {
    mock.failures.pathOrder = true
    const path = await $fetch<{ editorial: boolean }>('/api/reading-path', { query: { category: 'linux', locale: 'en' } })
    expect(path.editorial).toBe(false)
  })

  it('rejects an unknown locale without calling Strapi', async () => {
    await expect($fetch('/api/reading-path', { query: { category: 'linux', locale: 'legacy' } })).rejects.toMatchObject({ response: { status: 400 } })
    expect(mock.requests).toEqual([])
  })

  it('serves a category the CMS has even when no site constant knows it', async () => {
    const path = await $fetch<{ category: string, editorial: boolean, steps: unknown[] }>('/api/reading-path', { query: { category: 'garden', locale: 'en' } })
    expect(path).toMatchObject({ category: 'garden', editorial: false, steps: [] })
  })

  it('rejects a category the CMS does not have, or a malformed one, without reading articles', async () => {
    await expect($fetch('/api/reading-path', { query: { category: 'cooking' } })).rejects.toMatchObject({ response: { status: 400 } })
    await expect($fetch('/api/reading-path', { query: { category: 'not a slug' } })).rejects.toMatchObject({ response: { status: 400 } })
    await expect($fetch('/api/reading-path')).rejects.toMatchObject({ response: { status: 400 } })
    expect(mock.requests.some(item => item.path === '/api/articles')).toBe(false)
  })
})

describe('articles without a slug', () => {
  const slugless = { ...mock.articles[0], id: 9001, documentId: 'doc-slugless', title: 'Draft without a slug', slug: '' } as RawStrapiArticle

  beforeEach(() => {
    mock.articles.push(slugless)
    return () => {
      mock.articles.splice(mock.articles.indexOf(slugless), 1)
    }
  })

  it('leaves them out of the list and asks Strapi for slugs only', async () => {
    const list = await $fetch<{ data: Array<{ documentId: string, slug: string }> }>('/api/posts', { query: { locale: 'en' } })
    expect(list.data.length).toBeGreaterThan(0)
    expect(list.data.map(post => post.documentId)).not.toContain('doc-slugless')
    expect(list.data.every(post => post.slug)).toBe(true)
    const request = mock.requests.filter(item => item.path === '/api/articles').at(-1)
    expect(getNestedValue(request?.query ?? {}, ['filters', 'slug', '$notNull'])).toBe('true')
  })

  it('leaves them out of the sitemap', async () => {
    const xml = await (await fetch('/sitemap.xml')).text()
    expect(xml).not.toMatch(/\/blog\/<\/loc>/)
    for (const request of mock.requests.filter(item => item.path === '/api/articles').slice(-2)) {
      expect(getNestedValue(request.query, ['filters', 'slug', '$notNull'])).toBe('true')
    }
  })
})

describe('XML output of CMS values', () => {
  // An ampersand that does not start an entity, outside CDATA, makes the document invalid
  const rawAmpersand = /&(?!(?:amp|lt|gt|quot|apos|#\d+);)/

  it('escapes the slug and the cover URL in the feed and the slug in the sitemap', async () => {
    const article = mock.articles[0]!
    const original = { slug: article.slug, cover: article.cover }
    article.slug = 'a&b"c<d'
    article.cover = { ...article.cover!, url: 'https://cdn.example.com/x.png?a=1&b="2"' }
    try {
      const feed = await (await fetch('/feed.xml')).text()
      const sitemap = await (await fetch('/sitemap.xml')).text()
      for (const body of [feed, sitemap]) {
        const markup = body.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
        expect(markup).not.toMatch(rawAmpersand)
        expect(markup).not.toContain('a&b"c<d')
        expect(markup).toContain('a&amp;b&quot;c&lt;d')
      }
      expect(feed).toContain('<enclosure url="https://cdn.example.com/x.png?a=1&amp;b=&quot;2&quot;"')
    } finally {
      article.slug = original.slug
      article.cover = original.cover
    }
  })
})

describe('RSS feeds', () => {
  async function feed(path: string): Promise<{ status: number, type: string | null, cache: string | null, body: string }> {
    const response = await fetch(path)
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      cache: response.headers.get('cache-control'),
      body: await response.text(),
    }
  }

  function items(body: string): string[] {
    return [...body.matchAll(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map(match => match[1]!)
  }

  it('keeps the full feed in English and Spanish, now also at /es/feed.xml', async () => {
    const english = await feed('/feed.xml')
    expect(english.status).toBe(200)
    expect(english.type).toBe('application/rss+xml; charset=utf-8')
    expect(english.cache).toBe('public, s-maxage=1800, stale-while-revalidate=3600')
    expect(english.body).toContain('<title>Micelio</title>')
    expect(english.body).toContain('<generator>Micelio</generator>')
    // The mock's English description is empty: the neutral fallback
    expect(english.body).toContain('<description>Latest articles from Micelio.</description>')
    expect(english.body).toContain(`<atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>`)
    expect(items(english.body)).toEqual(['Understanding Vue Composables', 'Linux Server Hardening Guide'])

    const spanish = await feed('/es/feed.xml')
    const legacy = await feed('/feed.xml?lang=es')
    expect(spanish.status).toBe(200)
    expect(spanish.body.replace(/<lastBuildDate>.*<\/lastBuildDate>/, '')).toBe(legacy.body.replace(/<lastBuildDate>.*<\/lastBuildDate>/, ''))
    expect(spanish.body).toContain('<title>Micelio (Español)</title>')
    expect(spanish.body).toContain('<description>Un motor de blogs</description>')
    expect(items(spanish.body)).toEqual(['Guía de Vue Composables'])
  })

  it('serves one feed per category with only its articles, in each language', async () => {
    const linux = await feed('/feed/linux.xml')
    expect(linux.status).toBe(200)
    expect(linux.type).toBe('application/rss+xml; charset=utf-8')
    expect(linux.cache).toBe('public, s-maxage=1800, stale-while-revalidate=3600')
    expect(linux.body).toContain('<title>Micelio - Linux and open source</title>')
    expect(linux.body).toContain('<description>Micelio articles about Linux and open source.</description>')
    expect(linux.body).toContain(`<link>${SITE_URL}/blog/category/linux</link>`)
    expect(linux.body).toContain(`<atom:link href="${SITE_URL}/feed/linux.xml" rel="self" type="application/rss+xml"/>`)
    expect(linux.body).toContain(`<atom:link href="${SITE_URL}/es/feed/linux.xml" rel="alternate" type="application/rss+xml" hreflang="es"/>`)
    expect(items(linux.body)).toEqual(['Linux Server Hardening Guide'])

    const software = await feed('/es/feed/software.xml')
    expect(software.status).toBe(200)
    expect(software.body).toContain('<title>Micelio - Desarrollo de software</title>')
    expect(software.body).toContain('<language>es-co</language>')
    expect(software.body).toContain(`<atom:link href="${SITE_URL}/es/feed/software.xml" rel="self" type="application/rss+xml"/>`)
    expect(items(software.body)).toEqual(['Guía de Vue Composables'])

    const request = mock.requests.filter(item => item.path === '/api/articles').at(-1)
    expect(request?.query).toMatchObject({ locale: 'es', filters: { category: { slug: { $eq: 'software' } } } })
  })

  it('returns a valid empty feed for a category without articles', async () => {
    const privacy = await feed('/feed/privacidad.xml')
    expect(privacy.status).toBe(200)
    expect(privacy.body).toContain('<title>Micelio - Privacy</title>')
    expect(privacy.body).not.toContain('<item>')
    expect(privacy.body.trim().endsWith('</channel>\n</rss>')).toBe(true)
  })

  it('serves the feed of a category the CMS has even when no site constant knows it', async () => {
    const garden = await feed('/feed/garden.xml')
    expect(garden.status).toBe(200)
    expect(garden.body).toContain('<title>Micelio - Garden</title>')
    expect(garden.body).toContain(`<link>${SITE_URL}/blog/category/garden</link>`)
    expect(garden.body).not.toContain('<item>')
  })

  it('names the Spanish feed of an untranslated category after its slug', async () => {
    const kitchen = await feed('/es/feed/kitchen.xml')
    expect(kitchen.status).toBe(200)
    expect(kitchen.body).toContain('<title>Micelio - kitchen</title>')
  })

  it('answers 404 for the feed of an unknown category', async () => {
    expect((await feed('/feed/cooking.xml')).status).toBe(404)
    expect((await feed('/es/feed/cooking.xml')).status).toBe(404)
  })

  it('names the feed from app.config.ts (the neutral name) when Strapi has no site-setting', async () => {
    mock.failures.site = true
    const english = await feed('/feed.xml')
    expect(english.status).toBe(200)
    expect(english.body).toContain('<title>Micelio</title>')
    expect(english.body).toContain('<generator>Micelio</generator>')
    expect(english.body).toContain('<description>Latest articles from Micelio.</description>')
  })

  it('answers 404 for unknown categories or files without calling Strapi', async () => {
    expect((await feed('/feed/cooking.xml')).status).toBe(404)
    expect((await feed('/es/feed/cooking.xml')).status).toBe(404)
    expect((await feed('/feed/linux.json')).status).toBe(404)
    expect(mock.requests.some(item => item.path === '/api/articles')).toBe(false)
  })
})

describe('/api/search', () => {
  it('returns an empty array when q is missing', async () => {
    const result = await $fetch('/api/search')
    expect(result).toEqual([])
  })

  it('returns an empty array when q is shorter than 3 characters', async () => {
    const result = await $fetch('/api/search', { query: { q: 'vu' } })
    expect(result).toEqual([])
  })

  it('returns projected results for a matching query, newest first', async () => {
    const result = await $fetch('/api/search', { query: { q: 'composables' } })
    expect(result).toEqual([
      {
        documentId: 'doc-vue-es',
        title: 'Guía de Vue Composables',
        slug: 'guia-vue-composables',
        description: 'Una guía profunda sobre composables de Vue.',
        publishedAt: '2026-02-02T10:00:00.000Z',
        category: { name: 'Desarrollo de software', slug: 'software' },
        matchedIn: 'title',
        snippet: 'Guía de Vue Composables',
      },
      {
        documentId: 'doc-vue',
        title: 'Understanding Vue Composables',
        slug: 'understanding-vue-composables',
        description: 'A deep dive into writing reusable Vue composables.',
        publishedAt: '2026-02-01T10:00:00.000Z',
        category: { name: 'Desarrollo de software', slug: 'software' },
        matchedIn: 'title',
        snippet: 'Understanding Vue Composables',
      },
    ])
  })

  it('searches only the requested locale', async () => {
    const result = await $fetch<Array<{ slug: string }>>('/api/search', { query: { q: 'composables', locale: 'es' } })
    expect(result.map(post => post.slug)).toEqual(['guia-vue-composables'])
    const upstream = mock.requests.filter(request => request.path === '/api/articles/search')
    expect(upstream.at(-1)?.query.locale).toBe('es')
  })

  it('returns an empty array when the backend search fails', async () => {
    expect(await $fetch('/api/search', { query: { q: 'fail-search' } })).toEqual([])
  })
})

describe('/api/posts/[slug]', () => {
  it('returns the full article for a known slug', async () => {
    const result = await $fetch<RawStrapiArticle>('/api/posts/understanding-vue-composables', { query: { locale: 'en' } })
    expect(result.title).toBe('Understanding Vue Composables')
    expect(result.slug).toBe('understanding-vue-composables')
    expect(result.blocks).toHaveLength(1)
    expect(result.category?.slug).toBe('software')
    expect(result.tags?.map(tag => tag.name)).toEqual(['Vue', 'TypeScript', 'DevOps'])
  })

  it('renders the Markdown of each block on the server', async () => {
    const result = await $fetch<RawStrapiArticle>('/api/posts/understanding-vue-composables', { query: { locale: 'en' } })
    const block = result.blocks?.[0] as StrapiRichText
    expect(block.body).toContain('## Getting Started')
    expect(block.html).toBe('<h2 id="getting-started">Getting Started</h2>\n<p>Composables let you share stateful logic across components.</p>\n')
  })

  it('asks Strapi for the article references', async () => {
    await $fetch('/api/posts/understanding-vue-composables', { query: { locale: 'en' } })
    const upstream = mock.requests.filter(request => request.path === '/api/articles')
    expect(getNestedValue(upstream.at(-1)!.query, ['populate', 'references'])).toBe('true')
  })

  it('asks Strapi for the cover credit and the credit of every figure', async () => {
    await $fetch('/api/posts/understanding-vue-composables', { query: { locale: 'en' } })
    const upstream = mock.requests.filter(request => request.path === '/api/articles')
    const query = upstream.at(-1)!.query
    expect(getNestedValue(query, ['populate', 'coverCredit'])).toBe('true')
    expect(getNestedValue(query, ['populate', 'blocks', 'on', 'shared.media', 'populate'])).toMatchObject({ credit: 'true' })
    expect(getNestedValue(query, ['populate', 'blocks', 'on', 'shared.slider', 'populate', 'items', 'populate'])).toMatchObject({ credit: 'true' })
  })

  it('sets revalidation cache headers', async () => {
    let cacheControl = ''
    await $fetch('/api/posts/understanding-vue-composables', {
      query: { locale: 'en' },
      onResponse: (context: { response: { headers: { get: (name: string) => string | null } } }) => {
        cacheControl = context.response.headers.get('cache-control') || ''
      },
    })
    expect(cacheControl).toContain('s-maxage=300')
  })

  it('returns 404 for an unknown slug', async () => {
    await expect($fetch('/api/posts/unknown-slug')).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('refuses a slug that is not a Strapi uid with a 400 before any CMS call', async () => {
    const before = mock.requests.length
    for (const slug of ['a%20b', '%3Cscript%3E', 'a%00b', 'a%2Fb', 'a%2E%2E%2Fb', `a${'b'.repeat(300)}`, '-a', '%E2%82%AC']) {
      await expect($fetch(`/api/posts/${slug}`), slug).rejects.toMatchObject({ response: { status: 400 }, data: { message: 'Invalid slug' } })
    }
    expect(mock.requests.length).toBe(before)
  })

  it('answers 502 when Strapi fails', async () => {
    await expect($fetch('/api/posts/broken-article')).rejects.toMatchObject({ response: { status: 502 } })
  })

  it('returns the slug and language of each translation', async () => {
    const result = await $fetch<RawStrapiArticle>('/api/posts/guia-vue-composables', { query: { locale: 'es' } })
    expect(result.localizations).toEqual([
      { id: 1, documentId: 'doc-vue', slug: 'understanding-vue-composables', locale: 'en', publishedAt: '2026-02-01T10:00:00.000Z' },
    ])
    const upstream = mock.requests.filter(request => request.path === '/api/articles')
    expect(getNestedValue(upstream.at(-1)!.query, ['populate', 'localizations', 'fields'])).toEqual(['slug', 'locale', 'publishedAt'])
  })
})

describe('request bodies', () => {
  const CAP = 64 * 1024

  it('refuses a body over the cap with a 413 before the CMS or any route logic runs', async () => {
    const before = mock.requests.length
    const body = JSON.stringify({ identifier: 'lectora', password: 'x'.repeat(CAP) })
    for (const path of ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/newsletter/subscribe', '/api/comments?relation=api::article.article:doc-vue']) {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'origin': SITE_URL }, body })
      expect(response.status, path).toBe(413)
    }
    expect(mock.requests.length).toBe(before)
  })

  it('refuses it when the length is not declared, by counting what arrives', async () => {
    const { url } = useTestContext()
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(new URL('/api/auth/login', url), { method: 'POST', agent: false, headers: { 'content-type': 'application/json', 'origin': SITE_URL, 'transfer-encoding': 'chunked' } }, (res) => {
        res.resume()
        resolve(res.statusCode ?? 0)
      })
      req.on('error', reject)
      for (let i = 0; i < 40; i++) req.write('x'.repeat(4096))
      req.end()
    })
    expect(status).toBe(413)
  })

  it('still reads a normal body, a form-encoded one included', async () => {
    const response = await fetch('/api/newsletter/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click&token=unsubscribe-token-unknown-0000001' })
    expect(response.status).toBe(200)
  })
})

describe('HTTP methods', () => {
  // `fetch` refuses to send TRACE, so the request goes through node:http
  function send(method: string, path: string): Promise<{ status: number, allow: string | undefined, body: string }> {
    const { url } = useTestContext()
    return new Promise((resolve, reject) => {
      const req = httpRequest(new URL(path, url), { method, headers: { 'x-probe': 'echo-me' } }, (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, allow: res.headers.allow as string | undefined, body }))
      })
      req.on('error', reject)
      req.end()
    })
  }

  it('answers TRACE and other methods the site does not use with 405 and an Allow list', async () => {
    for (const path of ['/', '/api/posts', '/blog']) {
      const response = await send('TRACE', path)
      expect(response.status, path).toBe(405)
      expect(response.allow, path).toBe('GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS')
      expect(response.body).not.toContain('echo-me')
    }
  })

  it('keeps answering the methods it uses', async () => {
    expect((await send('GET', '/robots.txt')).status).toBe(200)
    expect((await send('HEAD', '/robots.txt')).status).toBe(200)
  })
})

describe('/robots.txt', () => {
  it('allows crawling and lists the sitemap', async () => {
    const response = await fetch('/robots.txt')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    const body = await response.text()
    expect(body).toContain('User-agent: *')
    expect(body).toContain('Allow: /')
    expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
  })
})

describe('/.well-known/security.txt', () => {
  it('answers 404 with an empty body when the site has no security contact', async () => {
    const response = await fetch('/.well-known/security.txt')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })

  it('answers 404 for a contact that is not a mailto: or https: URI', async () => {
    mock.securityContact.value = 'http://example.com/security'
    expect((await fetch('/.well-known/security.txt')).status).toBe(404)
  })

  it('serves the contact, the expiry, the languages and the canonical URL', async () => {
    mock.securityContact.value = 'mailto:security@example.com'
    const response = await fetch('/.well-known/security.txt')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    const body = await response.text()
    expect(body).toContain('Contact: mailto:security@example.com\n')
    expect(body).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/m)
    expect(body).toContain('Preferred-Languages: en, es\n')
    expect(body).toContain(`Canonical: ${SITE_URL}/.well-known/security.txt\n`)
    const expires = Date.parse(/^Expires: (.+)$/m.exec(body)![1]!)
    expect(Math.round((expires - Date.now()) / 86_400_000)).toBe(180)
  })

  it('answers 404 when the CMS fails, never a default contact', async () => {
    mock.failures.site = true
    expect((await fetch('/.well-known/security.txt')).status).toBe(404)
  })
})

describe('/.well-known/webfinger', () => {
  const HANDLE = 'acct:blog@bogdev.test'

  function webfinger(query: string, init?: RequestInit): Promise<Response> {
    return fetch(`/.well-known/webfinger${query}`, init)
  }

  it('answers the CMS JRD for the handle on the site host, with its status and Content-Type', async () => {
    const response = await webfinger(`?resource=${encodeURIComponent(HANDLE)}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/jrd+json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(await response.json()).toEqual(WEBFINGER_JRD)
  })

  it('answers what the CMS answers for another host and for a missing resource, never a 500', async () => {
    const other = await webfinger(`?resource=${encodeURIComponent('acct:blog@elsewhere.test')}`)
    expect(other.status).toBe(404)
    expect(await other.text()).toBe('Not Found')
    expect(other.headers.get('cache-control')).toBe('no-cache')
    const missing = await webfinger('')
    expect(missing.status).toBe(400)
    expect(await missing.text()).toBe('Missing resource parameter.')
    expect(mock.requests.filter(request => request.path === '/.well-known/webfinger').map(request => request.query)).toEqual([{ resource: 'acct:blog@elsewhere.test' }, {}])
  })

  it('sends only the first resource on, with no visitor header, cookie or credential', async () => {
    const response = await webfinger(`?resource=${encodeURIComponent(HANDLE)}&resource=acct:other@bogdev.test&rel=self&url=https://elsewhere.test`, {
      headers: { 'Cookie': 'micelio_session=secret', 'Authorization': 'Bearer visitor', 'X-Forwarded-For': '203.0.113.7', 'User-Agent': 'probe/1.0' },
    })
    expect(response.status).toBe(200)
    const [request] = mock.requests.filter(recorded => recorded.path === '/.well-known/webfinger')
    expect(request?.query).toEqual({ resource: HANDLE })
    expect(request?.authorization).toBeUndefined()
    expect(request?.forwarder).toBeUndefined()
    const headers = mock.webfingerHeaders.value ?? {}
    expect(headers.cookie).toBeUndefined()
    expect(headers['x-forwarded-for']).toBeUndefined()
    expect(headers['user-agent']).not.toBe('probe/1.0')
  })

  it('answers 404 without calling the CMS when the fediverse module is off', async () => {
    mock.modules.fediverse = false
    const response = await webfinger(`?resource=${encodeURIComponent(HANDLE)}`)
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
    expect(mock.requests).toEqual([])
  })

  it('refuses an overlong resource without calling the CMS', async () => {
    expect((await webfinger(`?resource=acct:${'a'.repeat(1100)}@bogdev.test`)).status).toBe(400)
    expect(mock.requests).toEqual([])
  })

  it('passes a CMS error on as it is, and stores none of it', async () => {
    mock.failures.webfinger = 'error'
    const response = await webfinger(`?resource=${encodeURIComponent(HANDLE)}`)
    expect(response.status).toBe(500)
    expect(await response.text()).toBe('Internal Server Error')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers 502 with an empty body when the CMS redirects or sends more than the cap', async () => {
    for (const failure of ['redirect', 'huge'] as const) {
      mock.failures.webfinger = failure
      const response = await webfinger(`?resource=${encodeURIComponent(HANDLE)}`, { redirect: 'manual' })
      expect(response.status).toBe(502)
      expect(response.headers.get('location')).toBeNull()
      expect(await response.text()).toBe('')
    }
  })

  it('sends a body of another type as opaque bytes, sandboxed', async () => {
    mock.failures.webfinger = 'html'
    const response = await webfinger(`?resource=${encodeURIComponent(HANDLE)}`)
    expect(response.headers.get('content-type')).toBe('application/octet-stream')
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('passes a CMS 429 on with its Retry-After', async () => {
    mock.failures.webfinger = 'limited'
    const response = await webfinger(`?resource=${encodeURIComponent(HANDLE)}`)
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('17')
  })

  // Last of the block: the visitor's bucket stays full for a minute
  it('answers 429 with Retry-After once a visitor passes its own limit, without calling the CMS', async () => {
    const statuses: number[] = []
    for (let index = 0; index < 31; index++) statuses.push((await webfinger(`?resource=${encodeURIComponent(HANDLE)}`)).status)
    expect(statuses.filter(status => status === 429).length).toBeGreaterThan(0)
    mock.requests.length = 0
    const limited = await webfinger(`?resource=${encodeURIComponent(HANDLE)}`)
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await limited.text()).toBe('')
    expect(mock.requests).toEqual([])
  })
})

describe('/sitemap.xml', () => {
  async function sitemap(): Promise<string> {
    const response = await fetch('/sitemap.xml')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    return response.text()
  }

  function entry(xml: string, loc: string): string {
    const match = xml.match(new RegExp(`<url>\\s*<loc>${SITE_URL}${loc}</loc>[\\s\\S]*?</url>`))
    expect(match, `missing <url> for ${loc}`).not.toBeNull()
    return match![0]
  }

  it('asks Strapi for the articles of each language with their translations', async () => {
    await sitemap()
    const upstream = mock.requests.filter(request => request.path === '/api/articles')
    expect(upstream.map(request => request.query.locale).sort()).toEqual(['en', 'es'])
    for (const request of upstream) {
      expect(getNestedValue(request.query, ['populate', 'localizations', 'fields'])).toEqual(['slug', 'locale', 'publishedAt'])
    }
  })

  it('lists each version of a translated article with the real slug of the other one', async () => {
    const xml = await sitemap()
    const links = [
      `<xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/blog/understanding-vue-composables"/>`,
      `<xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/es/blog/guia-vue-composables"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/blog/understanding-vue-composables"/>`,
    ]
    for (const loc of ['/blog/understanding-vue-composables', '/es/blog/guia-vue-composables']) {
      const url = entry(xml, loc)
      for (const link of links) expect(url).toContain(link)
    }
    expect(xml).not.toContain(`${SITE_URL}/es/blog/understanding-vue-composables`)
    expect(xml).not.toContain(`${SITE_URL}/blog/guia-vue-composables`)
  })

  it('leaves out the language of an article without a published translation', async () => {
    const xml = await sitemap()
    const url = entry(xml, '/blog/linux-server-hardening-guide')
    expect(url).toContain(`hreflang="en" href="${SITE_URL}/blog/linux-server-hardening-guide"`)
    expect(url).toContain(`hreflang="x-default" href="${SITE_URL}/blog/linux-server-hardening-guide"`)
    expect(url).not.toContain('hreflang="es"')
    expect(xml).not.toContain('guia-endurecer-servidor-linux')
  })

  it('lists every static page in both languages', async () => {
    const xml = await sitemap()
    for (const loc of ['/', '/es', '/blog', '/es/blog', '/about', '/es/about', '/privacy', '/es/privacy']) {
      const url = entry(xml, loc)
      expect(url).toContain(`hreflang="es" href="${SITE_URL}${loc.startsWith('/es') ? loc : loc === '/' ? '/es' : `/es${loc}`}"`)
    }
  })

  it('lists the category pages that have an article, in both languages, and no tag or page paths', async () => {
    const xml = await sitemap()
    for (const empty of ['privacidad', 'diy', 'ia', 'garden', 'kitchen']) expect(xml).not.toContain(`/blog/category/${empty}`)
    for (const category of ['software', 'linux']) {
      expect(entry(xml, `/blog/category/${category}`)).toContain(`hreflang="es" href="${SITE_URL}/es/blog/category/${category}"`)
      expect(entry(xml, `/es/blog/category/${category}`)).toContain(`hreflang="en" href="${SITE_URL}/blog/category/${category}"`)
    }
    expect(xml).not.toContain('/blog/tag/')
    expect(xml).not.toContain('/blog/page/')
  })
})

describe('legacy blog URLs', () => {
  it('moves a query-string filter of a category the CMS has to its path, not to a tag', async () => {
    const response = await fetch('/blog?category=garden', { redirect: 'manual' })
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('/blog/category/garden')
  })
})

describe('cookies without a session', () => {
  it('redirects to the browser language without a language cookie', async () => {
    const response = await fetch('/', { headers: { 'accept-language': 'es-CO,es;q=0.9' }, redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toMatch(/\/es$/)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('serves the privacy page without setting cookies', async () => {
    for (const path of ['/privacy', '/es/privacy']) {
      const response = await fetch(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toBeNull()
    }
  })
})

describe('errors from the CMS', () => {
  const relation = 'api::article.article:doc-vue'
  const routes: Array<[string, string, RequestInit?]> = [
    ['GET about', '/api/about?locale=en'],
    ['GET comments', `/api/comments?relation=${relation}`],
    ['GET flat comments', `/api/comments/flat?relation=${relation}`],
    ['POST comment', `/api/comments?relation=${relation}`, { method: 'POST', headers: { 'origin': SITE_URL, 'content-type': 'application/json' }, body: JSON.stringify({ author: { name: 'Dani', email: 'dani@example.com' }, content: 'Hello.' }) }],
    ['GET post', '/api/posts/understanding-vue-composables'],
    ['GET reading path', '/api/reading-path?category=linux&locale=en'],
    ['GET page', '/api/pages/privacy'],
    ['GET fediverse stats', '/api/fediverse/stats/doc-vue'],
    ['GET fediverse stats batch', '/api/fediverse/stats?documentIds=doc-vue'],
  ]

  for (const mode of ['json', 'plain'] as const) {
    it(`never put the CMS text, URL or query in a response body (${mode} failure)`, async () => {
      mock.failures.broken = mode
      for (const [name, path, init] of routes) {
        const response = await fetch(path, init)
        // Nitro's error body names the URL the visitor asked for, which is theirs; what must not appear is the CMS's
        const { url: _asked, ...body } = JSON.parse(await response.text()) as Record<string, unknown>
        const text = JSON.stringify(body)
        expect(response.status, name).toBeGreaterThanOrEqual(400)
        expect(text, `${name}: ${text}`).not.toMatch(/PROBE-CMS|select \* from|127\.0\.0\.1|localhost|populate|filters\[|\/api\/(articles|comments|about|pages|fediverse)/i)
      }
    })
  }

  it('does not tell a visitor how the API token is set: a CMS 401 or 403 is not copied', async () => {
    mock.failures.broken = 'json'
    for (const [name, path, init] of routes) {
      const response = await fetch(path, init)
      // A read answers 502 for a CMS 400; only posting a comment passes a 400 on
      expect(response.status, name).toBe(name === 'POST comment' ? 400 : 502)
    }
  })
})

describe('the flat comments list and the draft list rebuild their answer', () => {
  const relation = 'api::article.article:doc-vue'
  const leak = { token: 'cms-internal-token', debug: { sql: 'select 1' } }

  it('drops a top-level key the CMS adds to the flat comments list', async () => {
    mock.leaks.commentsEnvelope = { internalNote: leak, meta: leak }
    try {
      const body = await $fetch<Record<string, unknown>>('/api/comments/flat', { query: { relation, locale: 'en' } })
      expect(Object.keys(body).sort()).toEqual(['data', 'pagination'])
      expect(JSON.stringify(body)).not.toContain(leak.token)
    } finally {
      mock.leaks.commentsEnvelope = {}
    }
  })

  it('drops a key the CMS adds to a draft row', async () => {
    const login = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': SITE_URL },
      body: JSON.stringify({ identifier: testUsers.editor.username, password: testUsers.editor.password }),
    })
    const cookie = login.headers.getSetCookie().find(value => value.startsWith('__Host-micelio_session='))!.split(';')[0]!
    mock.leaks.draftRow = { createdBy: leak, internalNote: leak.token }
    try {
      const body = await (await fetch('/api/drafts', { headers: { cookie } })).json() as { data: Array<Record<string, unknown>> }
      expect(body.data.length).toBeGreaterThan(0)
      for (const row of body.data) expect(Object.keys(row).sort()).toEqual(['author', 'category', 'documentId', 'locale', 'publishedAt', 'slug', 'state', 'title', 'updatedAt'])
      expect(JSON.stringify(body)).not.toContain(leak.token)
    } finally {
      mock.leaks.draftRow = {}
    }
  })
})

describe('fields of an article that leave the server', () => {
  // What the CMS stores about a file, an author or a share override is not for the browser, whatever populate asked for
  const extras = { provider: 'storage-provider-x', hash: 'secret-hash', folderPath: '/1', email: 'author@example.com', internalNote: 'draft idea' }

  it('returns only the fields of the page for an article and for a list card', async () => {
    const article = mock.articles[0]!
    const original = { cover: article.cover, author: article.author, seo: article.seo, blocks: article.blocks, content: article.content }
    Object.assign(article, { internalNote: extras.internalNote, content: 'legacy body' })
    article.cover = { ...article.cover!, ...extras } as typeof article.cover
    article.author = { ...article.author!, ...extras } as typeof article.author
    article.seo = { ...(article.seo ?? { id: 1, metaTitle: 't', metaDescription: 'd' }), metaSocial: [{ id: 1, socialNetwork: 'Twitter', title: 'x', description: 'y' }], ...extras } as typeof article.seo
    article.blocks = [...(article.blocks ?? []), { id: 99, __component: 'shared.unknown', secret: 'x' } as never]
    try {
      const post = await $fetch<Record<string, unknown>>(`/api/posts/${article.slug}`, { query: { locale: 'en' } })
      const list = await $fetch<{ data: Array<Record<string, unknown>> }>('/api/posts', { query: { locale: 'en' } })
      const card = list.data.find(entry => entry.slug === article.slug)!
      for (const body of [post, card]) {
        const text = JSON.stringify(body)
        for (const value of Object.values(extras)) expect(text).not.toContain(value)
        expect(text).not.toContain('metaSocial')
        expect(text).not.toContain('shared.unknown')
        expect(text).not.toContain('legacy body')
      }
      expect(post).not.toHaveProperty('content')
      expect(post).toMatchObject({ slug: article.slug, title: article.title, cover: { url: article.cover!.url }, author: { name: article.author!.name } })
      expect(card).toMatchObject({ slug: article.slug, title: article.title, cover: { url: article.cover!.url } })
    } finally {
      Object.assign(article, original)
      delete (article as unknown as Record<string, unknown>).internalNote
      article.content = original.content
    }
  })

  it('returns only the fields of a card in the post lists of a page', async () => {
    const originals = mock.articles.map(article => ({ article, cover: article.cover, author: article.author, content: article.content }))
    for (const { article } of originals) {
      Object.assign(article, { internalNote: extras.internalNote, content: 'legacy body' })
      article.cover = { ...article.cover!, ...extras } as typeof article.cover
      article.author = { ...article.author!, ...extras } as typeof article.author
    }
    // No locale: its own cache key, so the answer of the page tests below is not served from memory
    try {
      const page = await $fetch<{ sections: Array<{ __component: string, posts?: Array<Record<string, unknown>> }> }>('/api/pages/showcase')
      const posts = page.sections.find(item => item.__component === 'section.post-list')!.posts!
      expect(posts.length).toBeGreaterThan(0)
      const text = JSON.stringify(posts)
      for (const value of [...Object.values(extras), 'legacy body']) expect(text).not.toContain(value)
      expect(posts[0]).toMatchObject({ slug: expect.any(String), title: expect.any(String) })
      expect(posts[0]).not.toHaveProperty('content')
    } finally {
      for (const { article, cover, author, content } of originals) {
        Object.assign(article, { cover, author, content })
        delete (article as unknown as Record<string, unknown>).internalNote
      }
    }
  })
})

describe('response schemas of the content routes', () => {
  it('describe what the real routes answer', async () => {
    const page = articlePageSchema.parse(await $fetch('/api/posts', { query: { locale: 'en' } }))
    expect(page.data.length).toBeGreaterThan(0)
    const post = articleSchema.parse(await $fetch(`/api/posts/${page.data[0]!.slug}`, { query: { locale: 'en' } }))
    expect(post.blocks?.length).toBeGreaterThan(0)
    const hits = z.array(searchResultSchema).parse(await $fetch('/api/search', { query: { q: 'ssh', locale: 'en', content: '1' } }))
    expect(hits.length).toBeGreaterThan(0)
    expect(readingPathSchema.parse(await $fetch('/api/reading-path', { query: { category: 'linux', locale: 'en' } })).steps.length).toBeGreaterThan(0)
    expect(aboutSchema.parse(await $fetch('/api/about', { query: { locale: 'en' } })).blocks.length).toBeGreaterThan(0)
    expect(siteSchema.parse(await $fetch('/api/site', { query: { locale: 'en' } })).name.length).toBeGreaterThan(0)
  })
})

describe('/api/about', () => {
  it('answers 502 with a fixed message when Strapi rejects the query, not with Strapi\'s text', async () => {
    mock.failures.about = true
    await expect($fetch('/api/about', { query: { locale: 'es' } })).rejects.toMatchObject({
      response: { status: 502 },
      data: { message: 'Failed to fetch about page' },
    })
  })

  it('rejects an unknown locale without calling Strapi', async () => {
    await expect($fetch('/api/about', { query: { locale: 'invalid' } })).rejects.toMatchObject({ response: { status: 400 } })
    expect(mock.requests).toEqual([])
  })
})

describe('/api/pages/[slug]', () => {
  type PageBody = Page
  function section<K extends PageSection['__component']>(page: PageBody, name: K): Extract<PageSection, { __component: K }> {
    return page.sections.find(item => item.__component === name) as Extract<PageSection, { __component: K }>
  }
  function pageRequests(): number {
    return mock.requests.filter(request => request.path === '/api/pages').length
  }

  const COMPONENTS = [
    'hero', 'feature-grid', 'media-showcase', 'stats', 'logo-cloud', 'testimonials', 'pricing',
    'faq', 'cta', 'post-list', 'newsletter', 'rich-text', 'gallery', 'scene',
  ].map(name => `section.${name}`)

  // Pages are cached by locale and slug for the life of the server, so the first read of each
  // one is the only one that reaches Strapi: the tests that inspect the requests come first.
  it('asks Strapi for one page, populating every nested relation, with the API token', async () => {
    await $fetch('/api/pages/muestra', { query: { locale: 'es' } })
    const request = mock.requests.find(item => item.path === '/api/pages')!
    expect(request.authorization).toBe('Bearer test-api-token')
    expect(request.query).toMatchObject({
      filters: { slug: { $eq: 'muestra' } },
      locale: 'es',
      pagination: { limit: '1' },
      populate: {
        seo: { populate: { metaImage: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] } } },
        localizations: { fields: ['slug', 'locale'] },
        sections: {
          on: {
            'section.hero': { populate: { primaryLink: 'true', secondaryLink: 'true', media: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] } } },
            'section.feature-grid': { populate: { items: { populate: { icon: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] } } } } },
            'section.media-showcase': { populate: { media: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] }, link: 'true' } },
            'section.logo-cloud': { populate: { logos: { populate: { image: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] } } } } },
            'section.testimonials': { populate: { items: { populate: { avatar: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] } } } } },
            'section.pricing': { populate: { plans: { populate: { link: 'true' } } } },
            'section.post-list': { populate: { category: { fields: ['slug'] }, tag: { fields: ['slug'] } } },
            'section.gallery': { populate: { images: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] } } },
            'section.scene': { populate: { model: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] }, poster: { fields: ['url', 'alternativeText', 'width', 'height', 'mime'] } } },
          },
        },
      },
    })
    const populate = request.query.populate as { sections: { on: Record<string, unknown> } }
    expect(Object.keys(populate.sections.on)).toEqual(COMPONENTS)
  })

  it('resolves the post list on the server', async () => {
    const page = await $fetch<PageBody>('/api/pages/showcase', { query: { locale: 'en' } })
    // Pages are cached per locale and slug and the tests above inspect the first read of some of them, so the response schema is checked here, on a page whose post list is resolved
    expect(pageSchema.parse(page).sections.map(item => item.__component)).toEqual(page.sections.map(item => item.__component))
    const list = section(page, 'section.post-list')
    expect(list.category).toBe('software')
    expect(list.posts.length).toBeGreaterThan(0)
    expect(list.posts.length).toBeLessThanOrEqual(3)
    expect(list.posts.every(post => post.category?.slug === 'software')).toBe(true)
    const articles = mock.requests.find(request => request.path === '/api/articles')!
    expect(articles.query).toMatchObject({
      locale: 'en',
      sort: 'publishedAt:desc',
      filters: { category: { slug: { $eq: 'software' } } },
      pagination: { page: '1', pageSize: '3' },
    })
  })

  it('resolves at most four post lists per page', async () => {
    const page = await $fetch<PageBody>('/api/pages/many-lists', { query: { locale: 'en' } })
    const lists = page.sections.filter(item => item.__component === 'section.post-list')
    expect(lists).toHaveLength(6)
    expect(mock.requests.filter(request => request.path === '/api/articles')).toHaveLength(4)
    expect(lists.map(list => list.posts.length > 0)).toEqual([true, true, true, true, false, false])
  })

  it.each([['en', 'showcase', 'muestra'], ['es', 'muestra', 'showcase']])('returns the %s showcase with its 14 sections', async (locale, slug, other) => {
    const response = await fetch(`/api/pages/${slug}?locale=${locale}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=600')
    const page = await response.json() as PageBody
    expect(page.slug).toBe(slug)
    expect(page.sections.map(item => item.__component)).toEqual(COMPONENTS)
    expect(page.seo).toMatchObject({ metaImage: { url: '/uploads/page-og.png' } })
    expect(page.translations).toEqual([{ locale: locale === 'en' ? 'es' : 'en', slug: other }])
  })

  it('serves a page already read from the cache, without calling Strapi', async () => {
    const first = await $fetch<PageBody>('/api/pages/showcase', { query: { locale: 'en' } })
    const second = await $fetch<PageBody>('/api/pages/showcase', { query: { locale: 'en' } })
    expect(second).toEqual(first)
    expect(mock.requests).toEqual([])
  })

  it('renders the Markdown of the sections to sanitized HTML and drops the sources', async () => {
    const page = await $fetch<PageBody>('/api/pages/showcase', { query: { locale: 'en' } })
    expect(section(page, 'section.media-showcase').html).toContain('<strong>cherry tomatoes</strong>')
    expect(section(page, 'section.faq').items[1]!.html).toContain('<a href="https://github.com/bogd3v/micelio"')
    expect(section(page, 'section.rich-text').html).toContain('<h2 id="about-this-page">About this page</h2>')
    expect(section(page, 'section.rich-text')).not.toHaveProperty('body')
    expect(section(page, 'section.pricing').plans[0]!.features).toEqual(['3 seed packs', 'A planting guide'])
  })

  it('drops invalid and unknown sections alone and gives an empty list when no post matches', async () => {
    const page = await $fetch<PageBody>('/api/pages/partial', { query: { locale: 'en' } })
    expect(page.sections.map(item => item.__component)).toEqual(['section.hero', 'section.post-list'])
    expect(section(page, 'section.post-list').posts).toEqual([])
    expect(page.translations).toEqual([])
    expect(page.seo).toBeUndefined()
  })

  it('answers 404 for a missing page, and does not store it: the page appears once published', async () => {
    const missing = await fetch('/api/pages/late-page?locale=en')
    expect(missing.status).toBe(404)
    expect(missing.headers.get('cache-control')).not.toContain('public')
    expect((await fetch('/api/pages/showcase?locale=es')).status).toBe(404)

    const late = { id: 99, documentId: 'page-late', title: 'Late', slug: 'late-page', locale: 'en', seo: null, sections: [], localizations: [] }
    pageFixtures.push(late)
    try {
      mock.requests.length = 0
      expect((await fetch('/api/pages/late-page?locale=en')).status).toBe(200)
      expect(pageRequests()).toBe(1)
    } finally {
      pageFixtures.splice(pageFixtures.indexOf(late), 1)
    }
  })

  it('rejects a bad slug or locale without calling Strapi', async () => {
    for (const path of ['/api/pages/Showcase', '/api/pages/a%20b', '/api/pages/-x', `/api/pages/${'x'.repeat(65)}`, '/api/pages/showcase?locale=fr']) {
      const response = await fetch(path)
      expect(response.status, path).toBe(400)
    }
    expect(mock.requests).toEqual([])
  })

  it('answers 502, never cached, when Strapi fails', async () => {
    const attempts: number[] = []
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch('/api/pages/broken-page')
      expect(response.status).toBe(502)
      expect(response.headers.get('cache-control')).not.toContain('public')
      attempts.push(pageRequests())
    }
    // The second failure reached Strapi again (fetch may retry, so compare, not count)
    expect(attempts[1]).toBeGreaterThan(attempts[0]!)
  })
})

describe('/api/site', () => {
  it('merges Strapi\'s site-setting over app.config, reading it with the API token', async () => {
    const response = await fetch('/api/site?locale=es')
    const site = await response.json()
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=600')
    expect(site).toMatchObject({
      name: 'Micelio',
      description: 'Un motor de blogs',
      url: 'https://micelio.test',
      author: { name: 'Grace', url: '' },
      logo: { url: `${mock.url}/uploads/logo.svg`, alternativeText: 'Micelio', width: 120, height: 40 },
      socialLinks: [{ network: 'codeberg', url: 'https://codeberg.org/micelio' }],
      contactEmail: 'hola@micelio.test',
      privacyContactEmail: '',
      supportHandle: 'micelio',
      modules: { comments: true, newsletter: true },
    })
    expect(mock.siteRequests).toEqual([expect.objectContaining({
      path: '/api/site-setting',
      query: { populate: { author: { fields: ['name', 'url'] }, logo: { fields: ['url', 'alternativeText', 'width', 'height'] }, favicon: { fields: ['url', 'alternativeText', 'width', 'height'] }, defaultOgImage: { fields: ['url', 'alternativeText', 'width', 'height'] }, socialLinks: 'true', modules: 'true', theme: { populate: '*' }, homePage: { fields: ['slug'] } }, locale: 'es' },
      authorization: 'Bearer test-api-token',
    })])
  })

  it('falls back field by field when a value is empty, to the empty default', async () => {
    const site = await $fetch<{ description: string, privacyContactEmail: string }>('/api/site', { query: { locale: 'en' } })
    expect(site.description).toBe('')
    expect(site.privacyContactEmail).toBe('')
    expect(site).toMatchObject({ privacyJurisdiction: '' })
  })

  it('answers with app.config\'s values, cached briefly, when Strapi fails', async () => {
    mock.failures.site = true
    const response = await fetch('/api/site')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=30, stale-while-revalidate=60')
    expect(await response.json()).toMatchObject({ name: 'Micelio', url: '', description: '', author: { name: '', url: '' }, socialLinks: [], supportHandle: '', modules: { comments: true } })
  })

  it('rejects an unknown locale without calling Strapi', async () => {
    await expect($fetch('/api/site', { query: { locale: 'fr' } })).rejects.toMatchObject({ response: { status: 400 } })
    expect(mock.requests).toEqual([])
  })
})

describe('homePage from Strapi', () => {
  async function html(path: string): Promise<string> {
    return (await fetch(path)).text()
  }

  it('is absent from /api/site when the site settings have none', async () => {
    const site = await $fetch<{ homePage?: unknown }>('/api/site')
    expect(site.homePage).toBeUndefined()
  })

  it('exposes the slug of the locale and nothing else', async () => {
    mock.homePage.value = { en: 'showcase', es: 'muestra' }
    expect(await $fetch('/api/site', { query: { locale: 'en' } })).toMatchObject({ homePage: { slug: 'showcase' } })
    const es = await $fetch<{ homePage: Record<string, unknown> }>('/api/site', { query: { locale: 'es' } })
    expect(es.homePage).toEqual({ slug: 'muestra' })
  })

  it('drops a slug that is not a page slug and keeps the rest of the site', async () => {
    mock.homePage.value = { en: '../etc' }
    const site = await $fetch<{ homePage?: unknown, name: string }>('/api/site', { query: { locale: 'en' } })
    expect(site.homePage).toBeUndefined()
    expect(site.name).toBe('Micelio')
  })

  it('renders the page at /, canonical /, and keeps /<slug> with a canonical to /', async () => {
    mock.homePage.value = { en: 'showcase', es: 'muestra' }
    const home = await html('/')
    expect(home).toContain('data-section="hero"')
    expect(home.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(home).toContain(`<link rel="canonical" href="${SITE_URL}/">`)
    const slug = await html('/showcase')
    expect(slug).toContain('data-section="hero"')
    expect(slug).toContain(`<link rel="canonical" href="${SITE_URL}/">`)
    const es = await html('/es/muestra')
    expect(es).toContain(`<link rel="canonical" href="${SITE_URL}/es">`)
  })

  it('points hreflang at canonical URLs, pairing the roots only when both are home pages', async () => {
    const link = (lang: string, path: string): string => `<link rel="alternate" hreflang="${lang}" href="${SITE_URL}${path}">`
    mock.homePage.value = { en: 'showcase', es: 'muestra' }
    const both = await html('/')
    expect(both).toContain(link('en', '/'))
    expect(both).toContain(link('es', '/es'))
    mock.homePage.value = { en: 'showcase', es: 'many-lists' }
    const enOnly = await html('/')
    expect(enOnly).toContain(link('en', '/'))
    expect(enOnly).toContain(link('es', '/es/muestra'))
    mock.homePage.value = { es: 'muestra' }
    const esOnly = await html('/showcase')
    expect(esOnly).toContain(link('en', '/showcase'))
    expect(esOnly).toContain(link('es', '/es'))
    expect(await html('/es/muestra')).toContain(link('en', '/showcase'))
    mock.homePage.value = null
    const neither = await html('/showcase')
    expect(neither).toContain(link('en', '/showcase'))
    expect(neither).toContain(link('es', '/es/muestra'))
  })

  it('falls back to the blog home when the page does not exist', async () => {
    mock.homePage.value = { en: 'ghost' }
    const response = await fetch('/')
    expect(response.status).toBe(200)
    const home = await response.text()
    expect(home).not.toContain('data-section="hero"')
    expect(home).toMatch(/<h1[\s>]/)
    expect(home).toContain('application/ld+json')
  })
})

describe('theme from Strapi', () => {
  // Pages that are not ISR, so every request renders
  const PAGE = '/account/sign-in'
  const SURFACE_RAISED = '#fbf6f0'
  const savedTheme = {
    id: 1,
    themeId: 'bogota',
    defaultMode: 'dia',
    displayFont: null,
    accentOverrides: [{ id: 1, mode: 'dia', color: '#FFFF00' }, { id: 2, mode: 'sepia', color: '#112233' }],
  }

  async function page(path: string): Promise<{ html: string, csp: string }> {
    const response = await fetch(path)
    return { html: await response.text(), csp: response.headers.get('content-security-policy') ?? '' }
  }

  it('without a theme renders the first mode and no overrides', async () => {
    const { html } = await page(PAGE)
    expect(html).toMatch(/<html[^>]* data-theme="noche" data-scheme="dark"/)
    // Only the specimen build names the header variant (ADR 0009, 2026-10-22 amendment)
    expect(html).not.toMatch(/<html[^>]*data-layout-header/)
    expect(html).not.toMatch(/<html[^>]*data-mode-default/)
    expect(html).not.toContain('theme-overrides')
    const site = await $fetch<{ theme?: unknown }>('/api/site')
    expect(site.theme).toBeUndefined()
  })

  it('writes the default mode and a corrected accent, and the CSP stays the same', async () => {
    const without = await page(PAGE)
    mock.theme.value = savedTheme
    const { html, csp } = await page(PAGE)
    expect(html).toMatch(/<html[^>]* data-theme="dia" data-scheme="light" data-mode-default="dia"/)
    const style = /<style id="theme-overrides">(\[data-theme="dia"\]\{--accent:(#[\da-f]{6});--accent-soft:#[\da-f]{6};--accent-hover:#[\da-f]{6};--on-accent:#[\da-f]{6}\})<\/style>/.exec(html)
    expect(style, 'one rule, for dia only').not.toBeNull()
    expect(style![2]).not.toBe('#ffff00')
    expect(contrastRatio(parseHex(style![2]!)!, parseHex(SURFACE_RAISED)!)).toBeGreaterThanOrEqual(4.5)
    expect(html).not.toContain('sepia')
    expect(csp).toBe(without.csp)
    const site = await $fetch<{ theme?: { id: string, defaultMode: string, accents: Record<string, { accent: string }> } }>('/api/site')
    expect(site.theme).toMatchObject({ id: 'bogota', defaultMode: 'dia', accents: { dia: { accent: style![2] } } })
    expect(Object.keys(site.theme!.accents)).toEqual(['dia'])
  })

  it('uses the request locale for the page and ignores another theme id', async () => {
    mock.theme.value = { themeId: 'other', defaultMode: 'noche', accentOverrides: [] }
    const { html } = await page(`/es${PAGE}`)
    expect(html).toMatch(/<html[^>]* data-theme="noche" data-scheme="dark" data-mode-default="noche"/)
    expect(html).not.toContain('theme-overrides')
    expect(mock.siteRequests.at(-1)?.query).toMatchObject({ locale: 'es' })
  })

  it('emits the display font, its fallback faces and a preload, same-origin, with the CSP unchanged', async () => {
    const without = await page(PAGE)
    mock.theme.value = { themeId: 'bogota', accentOverrides: [], displayFont: 'newsreader' }
    const { html, csp } = await page(PAGE)
    const href = /<link rel="preload" as="font" type="font\/woff2" href="(\/fonts\/display\/newsreader-latin-wght\.woff2\?v=[\da-f]{8})" crossorigin>/.exec(html)?.[1]
    expect(href, 'a preload for the font').toBeDefined()
    const style = /<style id="theme-overrides">([^<]*)<\/style>/.exec(html)?.[1] ?? ''
    expect(style).toContain(`@font-face{font-family:"Newsreader";font-style:normal;font-display:swap;font-weight:200 800;src:url("${href}") format("woff2")`)
    expect(style).toContain('font-family:"Newsreader Fallback"')
    expect(style).toContain(':root{--font-display:"Newsreader","Newsreader Fallback",Georgia,"Times New Roman",serif}')
    expect(html.indexOf('rel="preload" as="font" type="font/woff2" href="/fonts/display/')).toBeLessThan(html.indexOf('<style id="theme-overrides">'))
    expect(csp).toBe(without.csp)
    expect(csp).toContain('font-src \'self\'')
    const file = await fetch(href!)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-type')).toContain('font/woff2')
    expect(file.headers.get('content-security-policy')).toBe('default-src \'none\'; style-src \'unsafe-inline\'; frame-ancestors \'none\'; sandbox')
    expect(file.headers.get('cache-control')).toContain('max-age=31536000')
    expect((await file.arrayBuffer()).byteLength).toBeLessThanOrEqual(60 * 1024)
  })

  it('emits nothing for the theme\'s own display font, mono stays, and an unknown font is dropped', async () => {
    mock.theme.value = { themeId: 'bogota', accentOverrides: [], displayFont: 'archivo' }
    expect((await page(PAGE)).html).not.toContain('theme-overrides')
    mock.theme.value = { themeId: 'bogota', accentOverrides: [], displayFont: 'comic-sans' }
    const { html } = await page(PAGE)
    expect(html).not.toContain('theme-overrides')
    expect(html).not.toContain('/fonts/display/')
    mock.theme.value = { themeId: 'bogota', accentOverrides: [], displayFont: 'fraunces' }
    expect((await page(PAGE)).html).not.toMatch(/--font-mono|--font-sans/)
  })

  it('renders as before when Strapi fails', async () => {
    mock.theme.value = savedTheme
    mock.failures.site = true
    const { html } = await page(PAGE)
    expect(html).toMatch(/<html[^>]* data-theme="noche" data-scheme="dark"/)
    expect(html).not.toMatch(/<html[^>]*data-mode-default/)
    expect(html).not.toContain('theme-overrides')
  })
})

describe('site modules', () => {
  const offRoutes: [keyof typeof mock.modules, string, string?][] = [
    ['newsletter', '/api/newsletter/unsubscribe', 'POST'],
    ['comments', '/api/comments?relation=api::article.article:doc-vue'],
    ['accounts', '/api/auth/me'],
    ['drafts', '/api/drafts'],
    ['fediverse', '/api/fediverse/stats?documentIds=doc-vue'],
    ['search', '/api/search?q=vue'],
  ]

  it.each(offRoutes)('answers 404 on the %s routes when the module is off, without calling Strapi', async (module, path, method = 'GET') => {
    mock.modules[module] = false
    const response = await fetch(path, { method })
    expect(response.status).toBe(404)
    expect(mock.requests).toEqual([])
  })

  it('answers 404 on the pages of a module that is off, in both locales', async () => {
    mock.modules.accounts = false
    mock.modules.newsletter = false
    for (const path of ['/account/sign-in', '/es/account/sign-up', '/drafts', '/newsletter/unsubscribe', '/confirm']) {
      expect((await fetch(path)).status, path).toBe(404)
    }
    expect((await fetch('/blog')).status).toBe(200)
  })

  it('turns drafts off with accounts, and reports the modules that work in /api/site', async () => {
    mock.modules.accounts = false
    const site = await $fetch<{ modules: Record<string, boolean> }>('/api/site')
    expect(site.modules).toMatchObject({ accounts: false, drafts: false, comments: true })
  })
})

describe('/api/fediverse/stats', () => {
  it('returns likes and boosts of several federated articles in one request', async () => {
    const response = await fetch('/api/fediverse/stats?documentIds=doc-vue-es,doc-linux,doc-missing')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=120')
    expect(await response.json()).toEqual({
      'doc-vue-es': { likes: 4, boosts: 2 },
      'doc-linux': { likes: 0, boosts: 1 },
    })
    const upstream = mock.requests.filter(request => request.path === '/api/fediverse/articles/stats')
    expect(upstream).toHaveLength(1)
    expect(upstream[0]?.query.documentIds).toBe('doc-vue-es,doc-linux,doc-missing')
  })

  it('rejects missing, malformed or too many ids without calling the backend', async () => {
    const tooMany = Array.from({ length: 51 }, (_, index) => `doc-${index}`).join(',')
    await expect($fetch('/api/fediverse/stats')).rejects.toMatchObject({ response: { status: 400 } })
    await expect($fetch('/api/fediverse/stats', { query: { documentIds: 'doc-vue-es,../admin' } })).rejects.toMatchObject({ response: { status: 400 } })
    await expect($fetch('/api/fediverse/stats', { query: { documentIds: tooMany } })).rejects.toMatchObject({ response: { status: 400 } })
    expect(mock.requests.some(request => request.path.startsWith('/api/fediverse'))).toBe(false)
  })

  it('answers 502 when the backend fails', async () => {
    await expect($fetch('/api/fediverse/stats', { query: { documentIds: 'doc-broken' } })).rejects.toMatchObject({ response: { status: 502 } })
  })
})

describe('/api/fediverse/stats/[documentId]', () => {
  it('returns the likes and boosts of a federated article with a short cache', async () => {
    const response = await fetch('/api/fediverse/stats/doc-vue-es')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=120')
    expect(await response.json()).toEqual({ likes: 4, boosts: 2 })
    expect(mock.requests.map(request => request.path)).toContain('/api/fediverse/articles/doc-vue-es/stats')
  })

  it('answers 404 when the article is not federated', async () => {
    await expect($fetch('/api/fediverse/stats/doc-missing')).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('answers 502 when the backend fails', async () => {
    await expect($fetch('/api/fediverse/stats/doc-broken')).rejects.toMatchObject({ response: { status: 502 } })
  })

  it('rejects malformed document ids without calling the backend', async () => {
    await expect($fetch('/api/fediverse/stats/doc%2F..%2Fadmin')).rejects.toMatchObject({ response: { status: 400 } })
    expect(mock.requests.some(request => request.path.startsWith('/api/fediverse'))).toBe(false)
  })
})

describe('/api/comments', () => {
  const relation = 'api::article.article:doc-vue'

  it('returns approved comments with the fediverse fields and hides pending or rejected ones', async () => {
    const response = await $fetch<{ data: Array<Record<string, unknown>> }>('/api/comments/flat', { query: { relation } })
    const byId = new Map(response.data.map(comment => [comment.id, comment]))

    expect(commentsResponseSchema.safeParse(response).error?.issues ?? []).toEqual([])
    expect([...byId.keys()]).toEqual([201, 202, 203, 205])
    expect(byId.get(201)).toMatchObject({
      content: 'Great introduction to composables.',
      isAdminComment: false,
      fediverseActorHandle: null,
      fediverseUri: null,
    })
    expect(byId.get(202)).toMatchObject({
      fediverseActorHandle: '@bea@mastodon.social',
      fediverseUri: 'https://mastodon.social/users/bea/statuses/1',
      author: { name: 'Bea' },
    })
    expect(byId.get(203)).toMatchObject({ isAdminComment: true, threadOf: { id: 202 } })
  })

  it('keeps fediverse content as plain text and drops links that are not http(s)', async () => {
    const response = await $fetch<{ data: Array<Record<string, unknown>> }>('/api/comments/flat', { query: { relation } })
    const unsafe = response.data.find(comment => comment.id === 205)
    expect(unsafe).toMatchObject({ content: '<script>alert(1)</script>', fediverseActorHandle: '@eve@evil.example', fediverseUri: null })
  })

  it('never exposes the commenter email', async () => {
    const response = await $fetch<{ data: Array<{ author: Record<string, unknown> }> }>('/api/comments/flat', { query: { relation } })
    expect(response.data.every(comment => !('email' in comment.author))).toBe(true)
  })

  it('never returns an email or a report anywhere in a comment, the parent of a reply included', async () => {
    const flat = await $fetch<{ data: Array<{ id: number, threadOf?: Record<string, unknown> | null, reports?: unknown }> }>('/api/comments/flat', { query: { relation } })
    const tree = await $fetch<unknown>('/api/comments', { query: { relation } })
    for (const text of [JSON.stringify(flat), JSON.stringify(tree)]) {
      expect(text).not.toMatch(/example\.(com|org)/)
      expect(text).not.toContain('a reader wrote this')
    }
    expect(flat.data.find(comment => comment.id === 203)?.threadOf).toEqual({ id: 202 })
    expect(flat.data.every(comment => !comment.reports || (comment.reports as unknown[]).length === 0)).toBe(true)
  })

  it('does not return the parent author\'s email when a reply is posted', async () => {
    const response = await $fetch<Record<string, unknown>>('/api/comments', {
      method: 'POST',
      query: { relation },
      headers: { origin: SITE_URL },
      body: { author: { name: 'Dani', email: 'dani@example.com' }, content: 'Replying.', threadOf: 201 },
    })
    expect(commentSchema.safeParse(response).error?.issues ?? []).toEqual([])
    expect(JSON.stringify(response)).not.toContain('ana@example.com')
    expect(response.threadOf).toEqual({ id: 201 })
  })

  it('prunes hidden comments from the hierarchy, children included', async () => {
    const response = await $fetch<Array<{ id: number, children?: Array<{ id: number }> }>>('/api/comments', { query: { relation } })
    expect(commentTreeSchema.safeParse(response).error?.issues ?? []).toEqual([])
    expect(response.map(comment => comment.id)).toEqual([201, 202])
    expect(response[1]?.children?.map(child => child.id)).toEqual([203])
  })

  it('returns the posted blog comment without fediverse fields or email', async () => {
    const response = await $fetch<Record<string, unknown>>('/api/comments', {
      method: 'POST',
      query: { relation },
      headers: { origin: SITE_URL },
      body: { author: { name: 'Dani', email: 'dani@example.com' }, content: 'Nice post.' },
    })
    expect(commentSchema.safeParse(response).error?.issues ?? []).toEqual([])
    expect(response).toMatchObject({
      content: 'Nice post.',
      author: { name: 'Dani' },
      fediverseActorHandle: null,
      fediverseUri: null,
    })
    expect(response.author).not.toHaveProperty('email')
  })

  it('forwards only the allowed fields with an author id chosen by the server', async () => {
    await $fetch('/api/comments', {
      method: 'POST',
      query: { relation },
      headers: { origin: SITE_URL },
      body: { author: { id: 'admin', name: 'Eva', email: 'eva@example.com' }, content: 'Hola.', approvalStatus: 'APPROVED', isAdminComment: true, threadOf: 201 },
    })
    const request = mock.requests.filter(recorded => recorded.method === 'POST' && recorded.path === `/api/comments/${relation}`).at(-1)
    expect(Object.keys(request?.rawBody ?? {}).sort()).toEqual(['author', 'content', 'threadOf'])
    expect(request?.rawBody?.author).toMatchObject({ name: 'Eva', email: 'eva@example.com' })
    expect((request?.rawBody?.author as { id?: string }).id).toMatch(/^guest-[\w-]{36}$/)
  })

  it('rejects a comment from another origin or without one before calling Strapi', async () => {
    const body = { author: { name: 'Mallory', email: 'm@example.com' }, content: 'Spam.' }
    for (const headers of [{ origin: 'https://otro.sitio' }, {}] as Array<Record<string, string>>) {
      await expect($fetch('/api/comments', { method: 'POST', query: { relation }, headers, body })).rejects.toMatchObject({ response: { status: 403 } })
    }
    expect(mock.requests).toEqual([])
  })

  it('rejects an incomplete or oversized comment before calling Strapi', async () => {
    for (const body of [
      { author: { name: 'Ana' }, content: 'Sin correo.' },
      { author: { name: 'Ana', email: 'ana@example.com' }, content: 'x'.repeat(5001) },
    ]) {
      await expect($fetch('/api/comments', { method: 'POST', query: { relation }, headers: { origin: SITE_URL }, body })).rejects.toMatchObject({ response: { status: 400 } })
    }
    expect(mock.requests).toEqual([])
  })

  it('rejects a relation that is not an article without calling Strapi', async () => {
    for (const bad of ['../users', 'api::article.article:../../users', 'api::article.article:doc?x=1', 'api::user.user:1']) {
      await expect($fetch('/api/comments/flat', { query: { relation: bad } })).rejects.toMatchObject({ response: { status: 400 } })
      await expect($fetch('/api/comments', { query: { relation: bad } })).rejects.toMatchObject({ response: { status: 400 } })
      await expect($fetch('/api/comments', {
        method: 'POST',
        query: { relation: bad },
        headers: { origin: SITE_URL },
        body: { author: { name: 'Ana', email: 'ana@example.com' }, content: 'Hola.' },
      })).rejects.toMatchObject({ response: { status: 400 } })
    }
    expect(mock.requests).toEqual([])
  })

  it('no longer exposes comment edit or delete endpoints', async () => {
    for (const method of ['PUT', 'DELETE'] as const) {
      const response = await fetch(`/api/comments/201?relation=${relation}&authorId=guest-1`, { method, headers: { origin: SITE_URL } })
      expect(response.status).toBeGreaterThanOrEqual(404)
    }
    expect(mock.requests.filter(request => request.method === 'PUT' || request.method === 'DELETE')).toEqual([])
  })

  it('counts the IPv6 addresses of one /64 as one visitor', async () => {
    const body = { author: { name: 'Bot', email: 'bot6@example.com' }, content: 'Again.' }
    for (let i = 1; i <= 10; i++) {
      await $fetch('/api/comments', { method: 'POST', query: { relation }, headers: { 'origin': SITE_URL, 'x-forwarded-for': `2001:db8:77:1::${i}` }, body })
    }
    const blocked = await fetch(`/api/comments?relation=${relation}`, {
      method: 'POST',
      headers: { 'origin': SITE_URL, 'x-forwarded-for': '2001:db8:77:1::ffff', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(blocked.status).toBe(429)
    const otherNetwork = await fetch(`/api/comments?relation=${relation}`, {
      method: 'POST',
      headers: { 'origin': SITE_URL, 'x-forwarded-for': '2001:db8:78:1::1', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(otherNetwork.status).toBe(200)
  })

  it('limits how many comments one visitor can post', async () => {
    const headers = { 'origin': SITE_URL, 'x-forwarded-for': '203.0.113.10' }
    const body = { author: { name: 'Bot', email: 'bot@example.com' }, content: 'Again.' }
    for (let i = 0; i < 10; i++) {
      await $fetch('/api/comments', { method: 'POST', query: { relation }, headers, body })
    }
    const blocked = await fetch(`/api/comments?relation=${relation}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('requires the relation parameter', async () => {
    await expect($fetch('/api/comments/flat')).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('forwards the locale so each language gets its own thread', async () => {
    const english = await $fetch<{ data: Array<{ id: number }> }>('/api/comments/flat', { query: { relation, locale: 'en' } })
    const spanish = await $fetch<{ data: Array<{ id: number }> }>('/api/comments/flat', { query: { relation, locale: 'es' } })
    expect(english.data.map(comment => comment.id)).toEqual([201, 202, 203, 205])
    expect(spanish.data.map(comment => comment.id)).toEqual([208])

    const flatRequests = mock.requests.filter(request => request.path === `/api/comments/${relation}/flat`)
    expect(flatRequests.slice(-2).map(request => request.query.locale)).toEqual(['en', 'es'])
  })

  it('forwards the locale to the hierarchical thread', async () => {
    await $fetch('/api/comments', { query: { relation, locale: 'es' } })
    const request = mock.requests.filter(recorded => recorded.method === 'GET' && recorded.path === `/api/comments/${relation}`).at(-1)
    expect(request?.query.locale).toBe('es')
  })

  it('posts the comment in the language it was written in', async () => {
    await $fetch('/api/comments', {
      method: 'POST',
      query: { relation },
      headers: { origin: SITE_URL },
      body: { author: { name: 'Luis', email: 'luis@example.com' }, content: 'Buen artículo.', locale: 'es' },
    })
    const request = mock.requests.filter(recorded => recorded.method === 'POST' && recorded.path === `/api/comments/${relation}`).at(-1)
    expect(request?.body?.locale).toBe('es')
  })

  it('rejects an unknown locale without calling Strapi', async () => {
    const before = mock.requests.length
    await expect($fetch('/api/comments/flat', { query: { relation, locale: 'fr' } })).rejects.toMatchObject({ response: { status: 400 } })
    await expect($fetch('/api/comments', { query: { relation, locale: 'fr' } })).rejects.toMatchObject({ response: { status: 400 } })
    await expect($fetch('/api/comments', {
      method: 'POST',
      query: { relation },
      headers: { origin: SITE_URL },
      body: { author: { name: 'Jean', email: 'jean@example.com' }, content: 'Bonjour.', locale: 'fr' },
    })).rejects.toMatchObject({ response: { status: 400 } })
    expect(mock.requests.length).toBe(before)
  })
})

describe('/api/newsletter/subscribe', () => {
  const headers = { origin: SITE_URL }
  const subscribe = (body: Record<string, unknown>, extra: Record<string, string> = {}) =>
    $fetch('/api/newsletter/subscribe', { method: 'POST', headers: { ...headers, ...extra }, body })

  it('returns 400 when email is missing', async () => {
    await expect(subscribe({})).rejects.toMatchObject({
      response: { status: 400 },
      data: { statusMessage: 'Email is required' },
    })
  })

  it('returns 400 for an invalid email', async () => {
    await expect(subscribe({ email: 'not-an-email' })).rejects.toMatchObject({ response: { status: 400 } })
    await expect(subscribe({ email: 42 })).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('rejects a subscription from another origin or without one before calling Strapi', async () => {
    for (const origin of ['https://otro.sitio', undefined]) {
      await expect($fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: origin ? { origin } : {},
        body: { email: 'victim@example.com' },
      })).rejects.toMatchObject({ response: { status: 403 } })
    }
    expect(mock.requests).toEqual([])
  })

  it('answers an already confirmed subscriber like a new one, without touching it', async () => {
    expect(await subscribe({ email: 'confirmed@example.com' })).toMatchObject({ success: true })
    const writes = mock.requests.filter(request => request.method !== 'GET' && request.path.startsWith('/api/subscribers') && request.path !== LOOKUP_PATH)
    expect(writes).toEqual([])
  })

  it('deletes the subscriber it created when the confirmation email cannot be sent', async () => {
    const email = 'rollback@example.com'
    await expect(subscribe({ email })).rejects.toMatchObject({ response: { status: 500 } })
    const calls = mock.requests.filter(request => request.path.startsWith('/api/subscribers') && request.method !== 'GET' && request.path !== LOOKUP_PATH)
    const created = calls.findIndex(request => request.method === 'POST' && request.body?.data?.email === email)
    expect(created).toBeGreaterThanOrEqual(0)
    // The record the route just made is deleted, by the id the CMS gave it
    expect(calls.slice(created + 1).map(request => `${request.method} ${request.path.replace(/\d+$/, 'N')}`)).toEqual(['DELETE /api/subscribers/sub-N'])
  })

  it('replaces a pending subscriber before creating a new one', async () => {
    await expect(subscribe({ email: 'pending@example.com' })).rejects.toMatchObject({ response: { status: 500 } })
    const deleteRequest = mock.requests.find(
      request => request.method === 'DELETE' && request.path === '/api/subscribers/sub-pending',
    )
    expect(deleteRequest).toBeDefined()
    const posts = mock.requests.filter(
      request =>
        request.method === 'POST'
        && request.path === '/api/subscribers'
        && request.body?.data?.email === 'pending@example.com'
        && request.body?.data?.confirmed === false,
    )
    expect(posts.length).toBeGreaterThan(0)
  })

  it('returns 500 when SMTP is unreachable but still creates the subscriber in Strapi', async () => {
    await expect(subscribe({ email: 'new@example.com', locale: 'en' })).rejects.toMatchObject({ response: { status: 500 } })
    const posts = mock.requests.filter(request => request.method === 'POST' && request.path === '/api/subscribers')
    const lastPost = posts[posts.length - 1]
    expect(lastPost?.body?.data).toMatchObject({ email: 'new@example.com', confirmed: false, language: 'en' })
    // The CMS keeps the hash of the token the email carries, and no unsubscribe token before the subscriber confirms
    expect(lastPost?.body?.data?.confirmationToken).toMatch(/^[0-9a-f]{64}$/)
    expect(lastPost?.body?.data).not.toHaveProperty('unsubscribeToken')
    expect(lastPost?.body?.data).not.toHaveProperty('locale')
  })

  it('stores the Spanish language and treats any other locale as English', async () => {
    await ignoreError(subscribe({ email: 'es@example.com', locale: 'es' }))
    await ignoreError(subscribe({ email: 'fr@example.com', locale: 'fr' }))
    const languages = mock.requests
      .filter(request => request.method === 'POST' && request.path === '/api/subscribers')
      .map(request => [request.body?.data?.email, request.body?.data?.language])
    expect(languages).toEqual([['es@example.com', 'es'], ['fr@example.com', 'en']])
  })

  it('limits confirmation emails to the same address, whatever the visitor', async () => {
    for (let i = 0; i < 3; i++) {
      await ignoreError(subscribe({ email: 'Target@Example.com' }, { 'x-forwarded-for': `198.51.100.${i}` }))
    }
    await expect(subscribe({ email: 'target@example.com' }, { 'x-forwarded-for': '198.51.100.9' })).rejects.toMatchObject({ response: { status: 429 } })
    const created = mock.requests.filter(request => request.method === 'POST' && request.body?.data?.email === 'target@example.com')
    expect(created).toHaveLength(3)
  })

  it('limits how many subscriptions one visitor can request', async () => {
    const visitor = { 'x-forwarded-for': '198.51.100.50' }
    for (let i = 0; i < 10; i++) {
      await ignoreError(subscribe({ email: `reader${i}@example.com` }, visitor))
    }
    await expect(subscribe({ email: 'reader10@example.com' }, visitor)).rejects.toMatchObject({ response: { status: 429 } })
  })
})

describe('/api/newsletter/confirm', () => {
  const confirm = (token: unknown, headers: Record<string, string> = { origin: SITE_URL }) =>
    $fetch('/api/newsletter/confirm', { method: 'POST', headers, body: { token } })

  it('confirms the subscriber, keeps an unsubscribe token and succeeds even if the welcome email fails', async () => {
    const result = await confirm('confirmation-token-to-confirm-0001')
    expect(result).toMatchObject({ success: true, alreadyConfirmed: false })
    const update = mock.requests.find(request => request.method === 'PUT' && request.path === '/api/subscribers/sub-to-confirm')
    expect(update?.body?.data).toMatchObject({ confirmed: true })
    expect(update?.body?.data).not.toHaveProperty('confirmationToken')
    expect(update?.body?.data?.unsubscribeToken).toMatch(/^[0-9a-f]{64}$/)
  })

  it('looks a hashed token up by its hash, so the token never reaches the CMS', async () => {
    const result = await confirm(HASHED_TOKENS.confirm)
    expect(result).toMatchObject({ success: true, alreadyConfirmed: false })
    const lookups = mock.requests.filter(request => request.path === LOOKUP_PATH)
    expect(lookups).toHaveLength(1)
    expect(lookups[0]?.rawBody).toEqual({ field: 'confirmationToken', value: createHash('sha256').update(HASHED_TOKENS.confirm).digest('hex') })
    const update = mock.requests.find(request => request.method === 'PUT' && request.path === '/api/subscribers/sub-hashed-to-confirm')
    expect(update?.body?.data?.unsubscribeToken).toMatch(/^[0-9a-f]{64}$/)
  })

  it('answers a reopened link as already confirmed without writing again', async () => {
    const result = await confirm('confirmation-token-to-confirm-0001')
    expect(result).toMatchObject({ success: true, alreadyConfirmed: true })
    expect(mock.requests.filter(request => request.method !== 'GET' && request.path !== LOOKUP_PATH)).toEqual([])
  })

  it('answers 404 for an unknown or malformed token and 400 for none', async () => {
    for (const token of ['confirmation-token-unknown-0001', 'bad token']) {
      await expect(confirm(token), token).rejects.toMatchObject({ response: { status: 404 } })
    }
    await expect(confirm(undefined)).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('does not change anything on a GET, which is what a link scanner sends', async () => {
    const before = mock.requests.length
    for (const query of [{ token: 'confirmation-token-to-confirm-0001' }, {}]) {
      await expect($fetch('/api/newsletter/confirm', { query }), JSON.stringify(query)).rejects.toMatchObject({ response: { status: 404 } })
    }
    expect(mock.requests.slice(before)).toEqual([])
  })

  it('refuses a request from another origin or without one before calling Strapi', async () => {
    const before = mock.requests.length
    for (const headers of [{ origin: 'https://otro.sitio' }, {}] as Array<Record<string, string>>) {
      await expect(confirm('confirmation-token-to-confirm-0001', headers)).rejects.toMatchObject({ response: { status: 403 } })
    }
    expect(mock.requests.slice(before)).toEqual([])
  })
})

describe('/api/newsletter/unsubscribe', () => {
  const deletes = () => mock.requests.filter(request => request.method === 'DELETE' && request.path.startsWith('/api/subscribers/'))

  it('deletes the subscriber of the token sent by the unsubscribe page', async () => {
    const result = await $fetch('/api/newsletter/unsubscribe', { method: 'POST', body: { token: 'unsubscribe-token-leaving-0001' } })
    expect(result).toEqual({ success: true })
    expect(deletes().map(request => request.path)).toEqual(['/api/subscribers/sub-leaving'])
  })

  it('accepts the RFC 8058 one-click POST with the token in the URL', async () => {
    const response = await fetch('/api/newsletter/unsubscribe?token=unsubscribe-token-one-click-0001', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(deletes().map(request => request.path)).toEqual(['/api/subscribers/sub-one-click'])
  })

  it('answers the same for an unknown or already used token, without deleting anything', async () => {
    for (const token of ['unsubscribe-token-leaving-0001', 'unsubscribe-token-unknown-0001']) {
      expect(await $fetch('/api/newsletter/unsubscribe', { method: 'POST', body: { token } })).toEqual({ success: true })
    }
    expect(deletes()).toEqual([])
  })

  it('rejects a missing or malformed token without calling Strapi', async () => {
    for (const body of [{}, { token: 'short' }, { token: 'has spaces in it, sadly' }]) {
      await expect($fetch('/api/newsletter/unsubscribe', { method: 'POST', body })).rejects.toMatchObject({ response: { status: 400 } })
    }
    expect(mock.requests.filter(request => request.path.startsWith('/api/subscribers'))).toEqual([])
  })
})

describe('the newsletter requests to the CMS', () => {
  it('carry no email and no token in a URL, only in the body of the lookup', async () => {
    const visitor = { 'x-forwarded-for': '203.0.113.90' }
    const email = 'confirmed@example.com'
    const tokens = ['confirmation-token-to-confirm-0001', 'unsubscribe-token-leaving-0001']
    await ignoreError($fetch('/api/newsletter/subscribe', { method: 'POST', headers: { origin: SITE_URL, ...visitor }, body: { email, locale: 'en' } }))
    await ignoreError($fetch('/api/newsletter/confirm', { method: 'POST', headers: { origin: SITE_URL }, body: { token: tokens[0] } }))
    await $fetch('/api/newsletter/unsubscribe', { method: 'POST', body: { token: tokens[1] } })
    const calls = mock.requests.filter(request => request.path.startsWith('/api/subscribers'))
    expect(calls.map(request => request.path)).toContain(LOOKUP_PATH)
    for (const call of calls) {
      expect(call.path, call.path).not.toMatch(/@|%40/)
      expect(JSON.stringify(call.query), call.path).toBe('{}')
      for (const token of tokens) expect(call.path).not.toContain(token)
    }
    expect(calls.some(request => request.method === 'GET')).toBe(false)
  })
})

describe('/api/newsletter/unsubscribe with hashed tokens', () => {
  it('deletes the subscriber without sending the token to the CMS', async () => {
    expect(await $fetch('/api/newsletter/unsubscribe', { method: 'POST', body: { token: HASHED_TOKENS.unsubscribe } })).toEqual({ success: true })
    expect(mock.requests.some(request => request.method === 'DELETE' && request.path === '/api/subscribers/sub-hashed-leaving')).toBe(true)
    const lookups = mock.requests.filter(request => request.path === LOOKUP_PATH)
    expect(JSON.stringify(lookups.map(request => request.rawBody))).not.toContain(`"${HASHED_TOKENS.unsubscribe}"`)
  })

  it('does not accept a stored hash as the token', async () => {
    const stored = createHash('sha256').update(HASHED_TOKENS.unsubscribe).digest('hex')
    expect(await $fetch('/api/newsletter/unsubscribe', { method: 'POST', body: { token: stored } })).toEqual({ success: true })
    expect(mock.requests.filter(request => request.method === 'DELETE')).toEqual([])
  })
})

describe('/newsletter/unsubscribe', () => {
  it('is private and kept out of search engines', async () => {
    for (const path of ['/newsletter/unsubscribe?token=unsubscribe-token-x-0001', '/es/newsletter/unsubscribe']) {
      const response = await fetch(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    }
  })
})

describe('Umami', () => {
  it('adds the tracker served from the site to the page', async () => {
    const html = await $fetch<string>('/about')
    expect(html).toMatch(/<script[^>]*src="\/bd\.js"[^>]*data-website-id="site-1"[^>]*data-domains="bogdev\.test"/)
    expect(html).not.toContain('plausible.io')
  })

  it('serves the tracker script through the proxy', async () => {
    const response = await fetch('/bd.js')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(MOCK_TRACKER_SCRIPT)
    expect(umami.requests.map(request => [request.method, request.path])).toEqual([['GET', '/bd.js']])
  })

  it('does not hand the visitor a redirect from Umami', async () => {
    const response = await fetch('/bd.js', { headers: { 'x-mock-redirect': '1' }, redirect: 'manual' })
    expect(response.status).toBe(502)
    expect(response.headers.get('location')).toBeNull()
    // The target is served by the mock itself, so a followed redirect would answer 200 and show up here, with no network involved
    expect(umami.requests.map(request => request.path)).not.toContain(MOCK_REDIRECT_TARGET)
  })

  it('forwards collected events with the visitor IP', async () => {
    const payload = JSON.stringify({ type: 'event', payload: { website: 'site-1', url: '/blog' } })
    const response = await fetch('/api/bd', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7, 10.0.0.2', 'user-agent': 'Mozilla/5.0 Test' },
      body: payload,
    })
    expect(response.status).toBe(200)
    const [request] = umami.requests
    expect(request).toMatchObject({ method: 'POST', path: '/api/bd', body: payload })
    expect(request?.headers['x-real-ip']).toBe('203.0.113.7')
    expect(request?.headers['user-agent']).toBe('Mozilla/5.0 Test')
  })

  it('replaces every client address header with the resolved one', async () => {
    await fetch('/api/bd', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '6.6.6.6, 203.0.113.8',
        'x-real-ip': '7.7.7.7',
        'cf-connecting-ip': '8.8.8.8',
        'true-client-ip': '9.9.9.9',
        'x-client-ip': '5.5.5.5',
        'forwarded': 'for=4.4.4.4',
        'cookie': '__Host-micelio_session=secret-session',
        'authorization': 'Bearer secret',
      },
      body: '{}',
    })
    const headers = umami.requests[0]?.headers
    expect(headers?.['x-forwarded-for']).toBe('203.0.113.8')
    expect(headers?.['x-real-ip']).toBe('203.0.113.8')
    for (const name of ['cf-connecting-ip', 'true-client-ip', 'x-client-ip', 'forwarded', 'cookie', 'authorization']) expect(headers?.[name]).toBeUndefined()
  })

  it('does not pass the Referer on: it holds the address of the page, query included, which can carry a reset code or a token', async () => {
    const referer = `${SITE_URL}/account/reset-password?code=PROBECODE0123456789`
    await fetch('/bd.js', { headers: { referer } })
    await fetch('/api/bd', { method: 'POST', headers: { 'content-type': 'application/json', referer }, body: '{}' })
    expect(umami.requests).toHaveLength(2)
    for (const request of umami.requests) expect(request.headers.referer, `${request.method} ${request.path}`).toBeUndefined()
  })

  it('leaves the other API routes alone', async () => {
    await $fetch('/api/categories', { query: { locale: 'en' } })
    expect(umami.requests).toEqual([])
  })
})

describe('/api/auth', () => {
  const origin = SITE_URL

  function post(path: string, body: unknown, headers: Record<string, string> = { origin }): Promise<Response> {
    return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  }

  function sessionCookie(response: Response): string {
    return response.headers.getSetCookie().find(cookie => cookie.startsWith('__Host-micelio_session=')) ?? ''
  }

  async function signIn(identifier: string, password: string): Promise<string> {
    const response = await post('/api/auth/login', { identifier, password })
    expect(response.status).toBe(200)
    return sessionCookie(response).split(';')[0]!
  }

  async function errorCode(response: Response): Promise<string | undefined> {
    return ((await response.json()) as { data?: { code?: string } }).data?.code
  }

  it('signs in with an httpOnly session cookie and returns the public user without the JWT', async () => {
    const response = await post('/api/auth/login', { identifier: testUsers.editor.email, password: testUsers.editor.password })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const cookie = sessionCookie(response)
    expect(cookie).toMatch(/^__Host-micelio_session=mock-jwt-102;/)
    expect(cookie).toContain('Max-Age=604800')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    // What the `__Host-` prefix asks of a cookie: Secure, Path=/ and no Domain
    expect(cookie).not.toMatch(/Domain=/i)
    const text = await response.text()
    expect(text).not.toContain('mock-jwt')
    expect(JSON.parse(text)).toEqual({ user: { username: 'alejandro', email: testUsers.editor.email, role: 'editor', createdAt: '2026-01-15T15:00:00.000Z' } })
    const me = mock.requests.find(request => request.path === '/api/users/me')
    expect(me?.authorization).toBe('Bearer mock-jwt-102')
    expect(me?.query).toMatchObject({ populate: 'role' })
  })

  it('rejects state changes from another origin or without one before calling Strapi', async () => {
    const foreign = await post('/api/auth/login', { identifier: testUsers.reader.username, password: testUsers.reader.password }, { origin: 'https://otro.sitio' })
    expect(foreign.status).toBe(403)
    expect(await errorCode(foreign)).toBe('forbiddenOrigin')
    const missing = await post('/api/auth/logout', {}, {})
    expect(missing.status).toBe(403)
    expect(mock.requests).toEqual([])
  })

  it('translates wrong credentials, unconfirmed emails and rate limits', async () => {
    const wrong = await post('/api/auth/login', { identifier: testUsers.reader.username, password: 'no-es-esta-1' })
    expect([wrong.status, await errorCode(wrong)]).toEqual([400, 'invalidCredentials'])
    expect(sessionCookie(wrong)).toBe('')
    const unconfirmed = await post('/api/auth/login', { identifier: testUsers.unconfirmed.username, password: testUsers.unconfirmed.password })
    expect([unconfirmed.status, await errorCode(unconfirmed)]).toEqual([400, 'emailNotConfirmed'])
    const limited = await post('/api/auth/login', { identifier: testUsers.rateLimited.username, password: testUsers.rateLimited.password })
    expect([limited.status, await errorCode(limited)]).toEqual([429, 'tooManyRequests'])
  })

  it('returns the current user from the cookie and null without it', async () => {
    const cookie = await signIn(testUsers.reader.username, testUsers.reader.password)
    const signedIn = await fetch('/api/auth/me', { headers: { cookie } })
    expect(signedIn.headers.get('cache-control')).toBe('private, no-store')
    expect(await signedIn.json()).toEqual({ user: { username: 'lectora', email: testUsers.reader.email, role: 'reader', createdAt: '2026-09-29T15:00:00.000Z' } })
    expect(await $fetch('/api/auth/me')).toEqual({ user: null })
    const expired = await fetch('/api/auth/me', { headers: { cookie: '__Host-micelio_session=mock-jwt-999' } })
    expect(await expired.json()).toEqual({ user: null })
    expect(sessionCookie(expired)).toContain('Max-Age=0')
  })

  it('signs out by clearing the cookie', async () => {
    const response = await post('/api/auth/logout', {})
    expect(response.status).toBe(200)
    expect(sessionCookie(response)).toMatch(/^__Host-micelio_session=;.*Max-Age=0/)
  })

  it('treats the cookies of earlier releases as no session, and does not touch them on logout', async () => {
    for (const cookie of ['micelio_session=mock-jwt-101', 'bd_session=mock-jwt-101']) {
      const me = await fetch('/api/auth/me', { headers: { cookie } })
      expect(await me.json()).toEqual({ user: null })
      expect(me.headers.getSetCookie()).toEqual([])
      const out = await fetch('/api/auth/logout', { method: 'POST', headers: { origin, cookie } })
      expect(out.status).toBe(200)
      expect(out.headers.getSetCookie().filter(value => /^(micelio|bd)_session=/.test(value))).toEqual([])
    }
  })

  it('refuses a password that holds the username, the email address or the site name, before the CMS', async () => {
    const site = await (await fetch('/api/site?locale=en')).json() as { name: string }
    mock.requests.length = 0
    for (const [body, why] of [
      [{ username: 'sofia.perez', email: 'otra@example.com', password: 'mi-sofia.perez-1-2' }, 'username'],
      [{ username: 'unnombre', email: 'camila.rojas@example.com', password: 'Camila-Rojas-1234' }, 'email'],
      [{ username: 'unnombre', email: 'otra@example.com', password: `${site.name.toLowerCase()}-es-mi-sitio-1` }, 'site name'],
    ] as const) {
      const response = await post('/api/auth/register', { ...body, acceptPrivacy: true })
      expect([response.status, await errorCode(response)], why).toEqual([400, 'weakPassword'])
    }
    expect(mock.requests.filter(request => request.path === '/api/auth/local/register')).toEqual([])
  })

  it('refuses a common password when registering and when resetting, before the CMS', async () => {
    mock.requests.length = 0
    const register = await post('/api/auth/register', { username: 'nuevo-usuario', email: 'nuevo@example.com', password: 'Qwertyuiop', acceptPrivacy: true })
    expect([register.status, await errorCode(register)]).toEqual([400, 'commonPassword'])
    const reset = await post('/api/auth/reset-password', { code: resetCode(testUsers.reader.username), password: '1234567890', passwordConfirmation: '1234567890' })
    expect([reset.status, await errorCode(reset)]).toEqual([400, 'commonPassword'])
    expect(mock.requests.filter(request => ['/api/auth/local/register', '/api/auth/reset-password'].includes(request.path))).toEqual([])
  })

  it('registers only with valid data and reports taken accounts', async () => {
    const invalid = await post('/api/auth/register', { username: 'ab', email: 'nuevo@example.com', password: 'corta', acceptPrivacy: true })
    expect([invalid.status, await errorCode(invalid)]).toEqual([400, 'invalidInput'])
    const noPrivacy = await post('/api/auth/register', { username: 'nueva', email: 'nueva@example.com', password: 'una-frase-larga', acceptPrivacy: false })
    expect(noPrivacy.status).toBe(400)
    expect(mock.requests).toEqual([])
    const taken = await post('/api/auth/register', { username: 'otra', email: testUsers.reader.email, password: 'una-frase-larga', acceptPrivacy: true })
    expect([taken.status, await errorCode(taken)]).toEqual([409, 'emailTaken'])
    const created = await post('/api/auth/register', { username: 'nueva', email: 'Nueva@Example.com', password: 'una-frase-larga', acceptPrivacy: true, role: 'editor' })
    expect(created.status).toBe(201)
    expect(sessionCookie(created)).toBe('')
    expect(mock.users.find(user => user.username === 'nueva')).toMatchObject({ email: 'nueva@example.com', confirmed: false, role: 'authenticated' })
  })

  it('never tells whether an email exists when recovering a password', async () => {
    const unknown = await post('/api/auth/forgot-password', { email: 'nadie@example.com' })
    const known = await post('/api/auth/forgot-password', { email: testUsers.reader.email })
    expect([unknown.status, await unknown.json()]).toEqual([200, { ok: true }])
    expect([known.status, await known.json()]).toEqual([200, { ok: true }])
    const resent = await post('/api/auth/resend-confirmation', { email: 'nadie@example.com' })
    expect(await resent.json()).toEqual({ ok: true })
    const limited = await post('/api/auth/forgot-password', { email: testUsers.rateLimited.email })
    expect(limited.status).toBe(429)
  })

  it('confirms the email only on the POST, with no session, and refuses a bad or used token before or at the CMS', async () => {
    // Its own account: confirming a seeded one would change other tests
    mock.users.push({ id: 152, username: 'porconfirmar', email: 'porconfirmar@example.com', password: 'por-confirmar-1', confirmed: false, role: 'authenticated' })
    const token = confirmationToken('porconfirmar')
    mock.requests.length = 0
    for (const confirmation of ['nope', token.toUpperCase(), token.slice(1), '']) {
      const malformed = await post('/api/auth/confirm-email', { confirmation })
      expect([malformed.status, await errorCode(malformed)], confirmation).toEqual([400, 'invalidInput'])
    }
    const foreign = await post('/api/auth/confirm-email', { confirmation: token }, { origin: 'https://evil.example' })
    expect(foreign.status).toBe(403)
    expect(mock.requests).toEqual([])

    const confirmed = await post('/api/auth/confirm-email', { confirmation: token })
    expect([confirmed.status, await confirmed.json()]).toEqual([200, { ok: true }])
    expect(sessionCookie(confirmed)).toBe('')
    expect(confirmed.headers.get('cache-control')).toContain('no-store')
    expect(mock.requests.map(request => [request.method, request.path, request.authorization])).toEqual([['POST', '/api/auth/email-confirmation', undefined]])
    expect(mock.users.find(user => user.username === 'porconfirmar')).toMatchObject({ confirmed: true })

    const reused = await post('/api/auth/confirm-email', { confirmation: token })
    expect([reused.status, await errorCode(reused)]).toEqual([400, 'invalidCode'])
    const unknown = await post('/api/auth/confirm-email', { confirmation: 'f'.repeat(40) })
    expect([unknown.status, await errorCode(unknown)]).toEqual([400, 'invalidCode'])
  })

  it('resets the password with a valid code without starting a session', async () => {
    const invalid = await post('/api/auth/reset-password', { code: 'nope', password: 'otra-frase-larga', passwordConfirmation: 'otra-frase-larga' })
    expect([invalid.status, await errorCode(invalid)]).toEqual([400, 'invalidCode'])
    const mismatch = await post('/api/auth/reset-password', { code: resetCode('pendiente'), password: 'otra-frase-larga', passwordConfirmation: 'distinta-frase-1' })
    expect(mismatch.status).toBe(400)
    const reset = await post('/api/auth/reset-password', { code: resetCode('pendiente'), password: 'otra-frase-larga', passwordConfirmation: 'otra-frase-larga' })
    expect(reset.status).toBe(200)
    expect(sessionCookie(reset)).toBe('')
    expect(await reset.text()).not.toContain('mock-jwt')
  })

  describe('change password', () => {
    const OLD = 'cambiable-segura-1'
    const NEW = 'una-frase-larga-y-nueva-2'
    let cookie: string

    beforeEach(async () => {
      mock.users.splice(mock.users.findIndex(user => user.username === 'cambiable') >>> 0, 1)
      mock.users.push({ id: 151, username: 'cambiable', email: 'cambiable@example.com', password: OLD, confirmed: true, role: 'authenticated' })
      cookie = await signIn('cambiable', OLD)
    })

    function change(body: unknown, headers: Record<string, string> = { origin, cookie }): Promise<Response> {
      return fetch('/api/auth/change-password', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
    }
    const changes = () => mock.requests.filter(request => request.path === '/api/auth/change-password')

    it('changes the password with the session, asks the CMS with the person\'s own JWT and renews the cookie', async () => {
      mock.requests.length = 0
      const response = await change({ currentPassword: OLD, password: NEW, passwordConfirmation: NEW })
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(await response.json()).toEqual({ ok: true })
      const request = changes()[0]!
      expect(request.authorization).toBe('Bearer mock-jwt-151')
      expect(request.rawBody).toEqual({ currentPassword: OLD, password: NEW, passwordConfirmation: NEW })
      expect(sessionCookie(response)).toMatch(/^__Host-micelio_session=mock-jwt-151;.*HttpOnly/)
      expect((await post('/api/auth/login', { identifier: 'cambiable', password: NEW })).status).toBe(200)
      const old = await post('/api/auth/login', { identifier: 'cambiable', password: OLD })
      expect([old.status, await errorCode(old)]).toEqual([400, 'invalidCredentials'])
    })

    it('refuses a new password that is common or built from the username, the address or the site, before the CMS', async () => {
      mock.requests.length = 0
      for (const [password, code] of [['Qwertyuiop', 'commonPassword'], ['mi-cambiable-nueva-1', 'weakPassword'], ['cambiable-segura-2', 'weakPassword']] as const) {
        const response = await change({ currentPassword: OLD, password, passwordConfirmation: password })
        expect([response.status, await errorCode(response)], password).toEqual([400, code])
      }
      expect(changes()).toEqual([])
    })

    it('says the current password is wrong without touching the session or the account', async () => {
      const response = await change({ currentPassword: 'no-es-esta-1', password: NEW, passwordConfirmation: NEW })
      expect([response.status, await errorCode(response)]).toEqual([400, 'wrongPassword'])
      expect(sessionCookie(response)).toBe('')
      expect((await post('/api/auth/login', { identifier: 'cambiable', password: OLD })).status).toBe(200)
    })

    it('refuses bad input before calling the CMS', async () => {
      mock.requests.length = 0
      for (const body of [
        { currentPassword: OLD, password: 'corta', passwordConfirmation: 'corta' },
        { currentPassword: OLD, password: NEW, passwordConfirmation: 'otra-frase-larga-3' },
        { currentPassword: OLD, password: OLD, passwordConfirmation: OLD },
        { currentPassword: '', password: NEW, passwordConfirmation: NEW },
        { password: NEW, passwordConfirmation: NEW },
        {},
      ]) {
        const response = await change(body)
        expect([response.status, await errorCode(response)], JSON.stringify(body)).toEqual([400, 'invalidInput'])
      }
      expect(changes()).toEqual([])
    })

    it('needs a session and the site origin, and calls nothing without them', async () => {
      mock.requests.length = 0
      const noSession = await change({ currentPassword: OLD, password: NEW, passwordConfirmation: NEW }, { origin })
      expect([noSession.status, await errorCode(noSession)]).toEqual([401, 'unauthorized'])
      for (const headers of [{ origin: 'https://otro.sitio', cookie }, { cookie }] as Array<Record<string, string>>) {
        const response = await change({ currentPassword: OLD, password: NEW, passwordConfirmation: NEW }, headers)
        expect([response.status, await errorCode(response)]).toEqual([403, 'forbiddenOrigin'])
      }
      expect(changes()).toEqual([])
    })

    it('clears the session when the CMS refuses the token', async () => {
      const response = await change({ currentPassword: OLD, password: NEW, passwordConfirmation: NEW }, { origin, cookie: '__Host-micelio_session=mock-jwt-999' })
      expect([response.status, await errorCode(response)]).toEqual([401, 'unauthorized'])
      expect(sessionCookie(response)).toMatch(/^__Host-micelio_session=;.*Max-Age=0/)
    })
  })

  it('deletes the account only with the right username and password', async () => {
    mock.users.push({ id: 150, username: 'borrable', email: 'borrable@example.com', password: 'borrable-segura-1', confirmed: true, role: 'authenticated' })
    const cookie = await signIn('borrable', 'borrable-segura-1')

    function remove(body: unknown): Promise<Response> {
      return fetch('/api/auth/me', { method: 'DELETE', headers: { 'content-type': 'application/json', origin, cookie }, body: JSON.stringify(body) })
    }

    const wrongPassword = await remove({ username: 'borrable', password: 'no-es-esta-1' })
    expect([wrongPassword.status, await errorCode(wrongPassword)]).toEqual([400, 'wrongPassword'])
    expect(sessionCookie(wrongPassword)).toBe('')
    const wrongUser = await remove({ username: 'lectora', password: 'borrable-segura-1' })
    expect(wrongUser.status).toBe(400)
    expect(mock.users.some(user => user.username === 'borrable')).toBe(true)
    expect(mock.requests.filter(request => request.method === 'DELETE')).toHaveLength(1)

    const deleted = await remove({ username: 'borrable', password: 'borrable-segura-1' })
    expect(deleted.status).toBe(200)
    expect(sessionCookie(deleted)).toContain('Max-Age=0')
    expect(mock.users.some(user => user.username === 'borrable')).toBe(false)
    const strapiDelete = mock.requests.filter(request => request.method === 'DELETE').at(-1)
    expect(strapiDelete).toMatchObject({ path: '/api/users/me', authorization: 'Bearer mock-jwt-150' })
  })

  it('asks for a session before deleting', async () => {
    const response = await fetch('/api/auth/me', { method: 'DELETE', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ username: 'lectora', password: 'x' }) })
    expect([response.status, await errorCode(response)]).toEqual([401, 'unauthorized'])
  })
})

describe('account pages', () => {
  it('are private, noindex and kept out of the sitemap', async () => {
    const response = await fetch('/account/sign-in')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(await response.text()).toMatch(/<meta name="robots" content="noindex, nofollow">/)
    const xml = await (await fetch('/sitemap.xml')).text()
    expect(xml).not.toContain('/account')
  })

  it('sends visitors without a session from /account to the sign-in page', async () => {
    const response = await fetch('/es/account', { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/es/account/sign-in?redirect=/es/account')
  })

  it('renders the account page for a signed-in reader', async () => {
    const login = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': SITE_URL },
      body: JSON.stringify({ identifier: testUsers.reader.username, password: testUsers.reader.password }),
    })
    const cookie = login.headers.getSetCookie().find(value => value.startsWith('__Host-micelio_session='))!.split(';')[0]!
    const html = await (await fetch('/account', { headers: { cookie } })).text()
    expect(html).toContain(testUsers.reader.email)
    expect(html).not.toContain('mock-jwt')
  })
})

describe('/api/drafts', () => {
  async function sessionFor(identifier: string, password: string): Promise<string> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': SITE_URL },
      body: JSON.stringify({ identifier, password }),
    })
    expect(response.status).toBe(200)
    mock.requests.length = 0
    return response.headers.getSetCookie().find(value => value.startsWith('__Host-micelio_session='))!.split(';')[0]!
  }

  it('answers 404 without a session, before calling Strapi', async () => {
    for (const path of ['/api/drafts', '/api/drafts/doc-linux?locale=en']) {
      const response = await fetch(path)
      expect(response.status).toBe(404)
      expect(response.headers.get('cache-control')).toMatch(/^(no-cache|private, no-store)$/)
    }
    expect(mock.requests).toEqual([])
  })

  it('answers 404 to a reader, with the reader JWT and not the API token', async () => {
    const cookie = await sessionFor(testUsers.reader.username, testUsers.reader.password)
    const list = await fetch('/api/drafts', { headers: { cookie } })
    const draft = await fetch('/api/drafts/doc-draft-pihole?locale=es', { headers: { cookie } })
    expect([list.status, draft.status]).toEqual([404, 404])
    expect(list.headers.get('cache-control')).toMatch(/^(no-cache|private, no-store)$/)
    expect(mock.requests.length).toBeGreaterThan(0)
    expect(mock.requests.every(request => request.authorization === 'Bearer mock-jwt-101')).toBe(true)
  })

  it('lists the drafts of every language for an editor, newest edit first', async () => {
    const cookie = await sessionFor(testUsers.editor.username, testUsers.editor.password)
    const response = await fetch('/api/drafts', { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const body = await response.json() as { data: Array<{ documentId: string, locale: string, state: string }>, meta: { count: number } }
    expect(draftListResponseSchema.safeParse(body).error?.issues ?? []).toEqual([])
    expect(body.meta.count).toBe(2)
    expect(body.data.map(draft => [draft.documentId, draft.locale, draft.state])).toEqual([
      ['doc-draft-pihole', 'es', 'never-published'],
      ['doc-linux', 'en', 'modified'],
    ])
    expect(mock.requests).toMatchObject([{ path: '/api/articles/drafts', authorization: 'Bearer mock-jwt-102' }])
  })

  it('returns a draft with the article populate and its published version', async () => {
    const cookie = await sessionFor(testUsers.editor.username, testUsers.editor.password)
    const response = await fetch('/api/drafts/doc-linux?locale=en', { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const body = await response.json() as { article: { title: string, blocks: unknown[] }, published: { slug: string } | null }
    expect(draftArticleResponseSchema.safeParse(body).error?.issues ?? []).toEqual([])
    expect(body.article.title).toBe('Linux Server Hardening Guide, second edition')
    expect(body.article.blocks).toHaveLength(1)
    expect(body.published).toMatchObject({ slug: 'linux-server-hardening-guide' })

    const draftRequest = mock.requests.find(request => request.query.status === 'draft')
    expect(draftRequest).toMatchObject({ path: '/api/articles/doc-linux', authorization: 'Bearer mock-jwt-102' })
    expect(draftRequest?.query.locale).toBe('en')
    expect(getNestedValue(draftRequest?.query, ['populate', 'blocks', 'on', 'shared.media', 'populate', 'credit'])).toBe('true')
    expect(getNestedValue(draftRequest?.query, ['populate', 'references'])).toBe('true')
    const publishedRequest = mock.requests.find(request => request.query.status === 'published')
    expect(publishedRequest?.authorization).toBe('Bearer mock-jwt-102')
  })

  it('marks a never published draft and answers 404 to an unknown one', async () => {
    const cookie = await sessionFor(testUsers.editor.username, testUsers.editor.password)
    const draft = await $fetch<{ article: { slug: string }, published: unknown }>('/api/drafts/doc-draft-pihole', { query: { locale: 'es' }, headers: { cookie } })
    expect(draftArticleResponseSchema.safeParse(draft).error?.issues ?? []).toEqual([])
    expect(draft).toMatchObject({ article: { slug: 'pi-hole-raspberry-pi' }, published: null })
    const missing = await fetch('/api/drafts/doc-nope?locale=es', { headers: { cookie } })
    expect(missing.status).toBe(404)
  })

  it('keeps drafts out of the sitemap, the feeds and the search', async () => {
    const pages = await Promise.all(['/sitemap.xml', '/feed.xml', '/es/feed.xml', '/feed/linux.xml', '/feed/privacidad.xml'].map(async path => (await fetch(path)).text()))
    const searches = await Promise.all([
      $fetch('/api/search', { query: { q: 'pi-hole', locale: 'es', content: '1' } }),
      $fetch('/api/search', { query: { q: 'second edition', locale: 'en', content: '1' } }),
    ])
    const output = [...pages, JSON.stringify(searches)].join('\n')
    for (const leak of ['pi-hole-raspberry-pi', 'Pi-hole en una Raspberry Pi', 'second edition']) {
      expect(output).not.toContain(leak)
    }
    const articleRequests = mock.requests.filter(request => request.path.startsWith('/api/articles'))
    expect(articleRequests.length).toBeGreaterThan(0)
    expect(articleRequests.every(request => request.query.status === undefined || request.query.status === 'published')).toBe(true)
  })
})

async function ignoreError(task: Promise<unknown>): Promise<void> {
  try {
    await task
  } catch {
    // The request is made for its side effects on the mock
  }
}

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

describe('security headers', () => {
  const sha256 = (content: string) => `'sha256-${createHash('sha256').update(content).digest('base64')}'`
  const scriptSources = (policy: string) => policy.split('; ').find(directive => directive.startsWith('script-src '))?.split(' ').slice(1) ?? []

  it('tells every response it cannot be framed, with a CSP, not only the pages', async () => {
    const digest = (await $fetch<string>('/')).match(/href="\/_t\/([0-9a-f]{64})\/theme\.css"/)?.[1]
    expect(digest, 'the page links the theme stylesheet').toBeTruthy()
    for (const path of ['/api/tags', '/api/posts', '/feed.xml', '/robots.txt', '/sitemap.xml', '/theme/images/bogdev.svg', `/_t/${digest}/fonts/archivo-latin-var.woff2`, `/_t/${digest}/theme.css`]) {
      const response = await fetch(path)
      expect(response.status, path).toBe(200)
      expect(response.headers.get('content-security-policy') ?? '', path).toContain('frame-ancestors \'none\'')
    }
  })

  it('serves a Worker script with its own policy, which the default framing policy does not replace', async () => {
    const dir = join(useTestContext().nuxt!.options.nitro.output!.dir!, 'public/_islands/workers')
    const file = readdirSync(dir).find(name => name.endsWith('.js'))!
    const response = await fetch(`/_islands/workers/${file}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toBe(`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src ${SITE_URL}/_islands/runtimes/; frame-ancestors 'none'`)
  })

  it('sends no <base> element, which base-uri \'none\' would block', async () => {
    for (const path of ['/', '/blog', '/es/blog']) {
      expect(await (await fetch(path)).text(), path).not.toMatch(/<base[\s>]/i)
    }
    expect((await fetch('/blog')).headers.get('content-security-policy') ?? '').toContain('base-uri \'none\'')
  })

  it('tells the pages that carry a reset code or a token not to send a Referer', async () => {
    for (const path of ['/account/reset-password?code=x', '/es/account/reset-password?code=x', '/confirm?token=confirmation-token-0000001', '/es/confirm?token=confirmation-token-0000001', '/newsletter/unsubscribe?token=unsubscribe-token-0000001', '/es/newsletter/unsubscribe?token=unsubscribe-token-0000001']) {
      const response = await fetch(path)
      expect(response.headers.get('referrer-policy'), path).toBe('no-referrer')
    }
  })

  it('asks the tracker on those pages to leave the query string out', async () => {
    const html = await (await fetch('/account/reset-password?code=x')).text()
    expect(html).toMatch(/<script[^>]*src="\/bd\.js"[^>]*data-exclude-search="true"/)
  })

  it('sends the fixed headers on pages and API routes', async () => {
    for (const path of ['/', '/account/sign-in', '/api/tags']) {
      const response = await fetch(path)
      expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
      expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin')
    }
  })

  it('allows exactly the inline scripts of each page by hash, also when the page comes from the ISR cache', async () => {
    for (const path of ['/', '/', '/blog', '/es/blog', '/account/sign-in', '/privacy']) {
      const response = await fetch(path)
      const policy = response.headers.get('content-security-policy') ?? ''
      const html = await response.text()
      const hashes = inlineScripts(html).map(sha256)
      expect(hashes.length).toBeGreaterThan(0)
      expect(scriptSources(policy).sort()).toEqual(['\'self\'', ...new Set(hashes)].sort())
      expect(policy).not.toContain('\'unsafe-inline\' \'sha256')
      expect(policy).toContain('frame-ancestors \'none\'')
    }
  })

  it('serves one theme init script, with the same hash on every page, and the first mode on <html>', async () => {
    const hashes = new Set<string>()
    for (const path of ['/', '/es/blog', '/account/sign-in', '/privacy']) {
      const html = await (await fetch(path)).text()
      expect(html).toMatch(/<html[^>]* data-theme="noche" data-scheme="dark"/)
      const init = inlineScripts(html).filter(script => script.includes('data-scheme'))
      expect(init).toHaveLength(1)
      hashes.add(sha256(init[0]!))
    }
    expect(hashes.size).toBe(1)
  })

  it('adds the model origin to connect-src on a page with a scene, and only there', async () => {
    const connect = (policy: string): string => policy.split('; ').find(directive => directive.startsWith('connect-src ')) ?? ''
    const scene = await fetch('/showcase')
    const html = await scene.text()
    expect(html).toContain('<micelio-scene data-model="')
    expect(connect(scene.headers.get('content-security-policy') ?? '')).toBe(`connect-src 'self' ${new URL(mock.url).origin}`)
    const other = await fetch('/blog')
    expect(connect(other.headers.get('content-security-policy') ?? '')).toBe('connect-src \'self\'')
  })

  it('allows images from Strapi and the media host', async () => {
    const policy = (await fetch('/blog')).headers.get('content-security-policy') ?? ''
    const images = policy.split('; ').find(directive => directive.startsWith('img-src ')) ?? ''
    expect(images).toContain(new URL(mock.url).origin)
    expect(images).toContain('https://resources.bogdev.com.co')
  })
})

describe('/api/posts pagination', () => {
  const articleRequests = () => mock.requests.filter(request => request.method === 'GET' && request.path === '/api/articles')

  it('caps the page size before asking Strapi', async () => {
    await $fetch('/api/posts', { query: { pageSize: 10000 } })
    expect((articleRequests().at(-1)?.query.pagination as { pageSize?: string })?.pageSize).toBe('50')
  })

  it('rejects a page or page size that is not a positive integer without calling Strapi', async () => {
    for (const query of [{ page: 'abc' }, { page: '0' }, { pageSize: 'NaN' }, { pageSize: '-5' }]) {
      await expect($fetch('/api/posts', { query })).rejects.toMatchObject({ response: { status: 400 } })
    }
    expect(articleRequests()).toEqual([])
  })

  it('rejects unknown locales and repeated parameters on the read routes without calling Strapi', async () => {
    for (const path of ['/api/posts?locale=fr', '/api/posts?category=a&category=b', '/api/posts?tag=vue&tag=ts', '/api/search?q=vue&locale=fr', '/api/categories?locale=fr', '/api/tags?locale=en&locale=es', '/api/posts/understanding-vue-composables?locale=fr']) {
      const response = await fetch(path)
      expect(response.status, path).toBe(400)
    }
    expect(mock.requests).toEqual([])
  })
})

describe('Strapi API token', () => {
  const API_TOKEN = 'Bearer test-api-token'

  it('sends the API token on content, comment and newsletter calls', async () => {
    await $fetch('/api/posts')
    await $fetch('/api/tags')
    await $fetch('/api/comments/flat', { query: { relation: 'api::article.article:doc-vue' } })
    await ignoreError($fetch('/api/newsletter/confirm', { method: 'POST', headers: { origin: SITE_URL }, body: { token: 'confirmation-token-unknown-0002' } }))
    const paths = ['/api/articles', '/api/tags', '/api/comments/api::article.article:doc-vue/flat', LOOKUP_PATH]
    for (const path of paths) {
      const request = mock.requests.find(recorded => recorded.path === path)
      expect(request, path).toBeDefined()
      expect(request?.authorization, path).toBe(API_TOKEN)
    }
  })

  it('keeps the public fediverse endpoints anonymous', async () => {
    await ignoreError($fetch('/api/fediverse/stats', { query: { documentIds: 'doc-vue' } }))
    await ignoreError($fetch('/api/posts', { query: { sort: 'fediverse' } }))
    const anonymous = mock.requests.filter(request => request.path.startsWith('/api/fediverse/'))
    expect(anonymous.length).toBeGreaterThan(0)
    expect(anonymous.every(request => request.authorization === undefined)).toBe(true)
  })

  it('sends the API token when the sitemap lists the articles (the static build reads the same data)', async () => {
    await fetch('/sitemap.xml')
    const articles = mock.requests.filter(request => request.path === '/api/articles')
    expect(articles.length).toBeGreaterThan(0)
    expect(articles.every(request => request.authorization === API_TOKEN)).toBe(true)
  })
})

describe('theme fonts', () => {
  /** The `/_t/<digest>/fonts/` base of the active theme, read from its preload links. */
  async function fontsBase(): Promise<string> {
    const html = await $fetch<string>('/')
    const base = html.match(/<link rel="preload" href="(\/_t\/[0-9a-f]{64}\/fonts\/)archivo-latin-var\.woff2"/)?.[1]
    expect(base, 'the page preloads the theme font from its store entry').toBeTruthy()
    return base!
  }

  it('preloads the preloaded font of the theme exactly once, and not the others', async () => {
    const base = await fontsBase()
    const html = await $fetch<string>('/')
    expect(html.split(`<link rel="preload" href="${base}archivo-latin-var.woff2"`)).toHaveLength(2)
    expect(html).not.toContain(`<link rel="preload" href="${base}jetbrains-mono-latin-var.woff2"`)
    expect(html).not.toContain('href="/fonts/archivo')
  })

  it('serves the fonts from the store entry like other static assets, and no longer at /fonts/', async () => {
    const base = await fontsBase()
    const font = await fetch(`${base}archivo-latin-var.woff2`)
    const asset = await fetch('/theme/images/bogdev.svg')
    expect(font.status).toBe(200)
    expect(font.headers.get('content-type')).toBe('font/woff2')
    for (const header of ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy']) {
      expect(font.headers.get(header)).toBe(asset.headers.get(header))
    }
    expect((await fetch('/fonts/archivo-latin-var.woff2')).status).toBe(404)
  })

  it('serves fonts and their licenses from the entry, with the sandbox CSP of the theme\'s static assets', async () => {
    const base = await fontsBase()
    const csp = 'default-src \'none\'; style-src \'unsafe-inline\'; frame-ancestors \'none\'; sandbox'
    expect((await fetch(`${base}archivo-latin-var.woff2`)).headers.get('content-security-policy')).toBe(csp)
    for (const license of ['OFL-Archivo.txt', 'OFL-JetBrainsMono.txt']) {
      const response = await fetch(`${base}${license}`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('content-security-policy')).toBe(csp)
    }
    expect((await fetch(`${base}archivo-latin-var.woff2.map`)).status).toBe(404)
  })
})

describe('/_islands/ (islands are built in every mode, ADR 0006)', () => {
  const islandFile = (): string => readdirSync(join(useTestContext().nuxt!.options.nitro.output!.dir!, 'public/_islands')).find(file => /^search-[\w-]+\.js$/.test(file))!

  it('serves an island of the dynamic build as immutable JavaScript', async () => {
    const response = await fetch(`/_islands/${islandFile()}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/javascript/)
    expect(response.headers.get('cache-control')).toMatch(/max-age=31536000/)
    expect(response.headers.get('cache-control')).toMatch(/immutable/)
    expect((await response.text()).length).toBeGreaterThan(1000)
  })

  it('answers 404 for an island that does not exist', async () => {
    expect((await fetch('/_islands/search-missing.js')).status).toBe(404)
  })

  it('renders no island script on a dynamic page', async () => {
    expect(await $fetch<string>('/blog')).not.toContain('/_islands/')
  })
})

describe('layout variants chosen at runtime (#402)', () => {
  const CHOSEN: Record<string, string[]> = {
    '/': ['RegionHeaderBar', 'RegionFooterColumns', 'RegionHomeShowcase'],
    '/blog': ['RegionHeaderBar', 'RegionFooterColumns', 'RegionPostListGrid'],
    '/blog/understanding-vue-composables': ['RegionHeaderBar', 'RegionFooterColumns', 'RegionArticleAside'],
  }
  const VARIANTS = ['RegionHeaderBar', 'RegionHeaderCentered', 'RegionHomeShowcase', 'RegionHomeIndex', 'RegionPostListGrid', 'RegionPostListList', 'RegionArticleAside', 'RegionArticleCentered', 'RegionFooterColumns', 'RegionFooterMinimal']

  // Each variant is its own chunk, found by the component name it declares (defineOptions)
  function variantChunks(): Map<string, string> {
    const dir = join(useTestContext().nuxt!.options.nitro.output!.dir!, 'public/_nuxt')
    const chunks = new Map<string, string>()
    for (const file of readdirSync(dir).filter(name => name.endsWith('.js'))) {
      const source = readFileSync(join(dir, file), 'utf8')
      for (const name of VARIANTS) if (new RegExp(`["'\`]${name}["'\`]`).test(source)) chunks.set(name, file)
    }
    return chunks
  }

  it('builds all ten variants, each one the build\'s theme does not use in a chunk of its own', () => {
    const chunks = variantChunks()
    expect([...chunks.keys()].sort()).toEqual([...VARIANTS].sort())
    // The chosen ones are bundled with their region (the header and footer share the layout's chunk)
    const unchosen = VARIANTS.filter(name => !Object.values(CHOSEN).flat().includes(name))
    expect(unchosen).toHaveLength(5)
    const files = [...chunks.values()]
    for (const name of unchosen) expect(files.filter(file => file === chunks.get(name)), name).toHaveLength(1)
  })

  it('sends a page only the chunks of the variants the active theme chose, preloaded, and no other', async () => {
    const chunks = variantChunks()
    for (const [path, chosen] of Object.entries(CHOSEN)) {
      const html = await $fetch<string>(path)
      for (const name of VARIANTS) {
        const file = chunks.get(name)!
        if (chosen.includes(name)) expect(html, `${path} ${name}`).toMatch(new RegExp(`<link rel="modulepreload"[^>]*${file.replace('.', '\\.')}`))
        else expect(html.includes(file), `${path} ${name}`).toBe(false)
      }
    }
  })
})

describe('theme specimen (built only with MICELIO_SPECIMEN=1)', () => {
  it('has no /_theme route', async () => {
    for (const path of ['/_theme', '/es/_theme']) expect((await fetch(path)).status, path).toBe(404)
  })

  it('ships none of its markup, name or messages', () => {
    const dir = join(useTestContext().nuxt!.options.nitro.output!.dir!, 'public/_nuxt')
    const files = readdirSync(dir).filter(file => /\.(js|css)$/.test(file))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8')
      for (const needle of ['myc-specimen', 'ThemeSpecimenPage', 'Every component, state and layout region']) {
        expect(source.includes(needle), `${file} contains ${needle}`).toBe(false)
      }
    }
  })
})

describe('visitor address for the CMS rate limits', () => {
  const relation = 'api::article.article:doc-vue'
  const visitor = { 'x-forwarded-for': '6.6.6.6, 203.0.113.77' }
  const commentBody = { author: { name: 'Ana', email: 'ana@example.com' }, content: 'Hello' }

  async function signIn(identifier: string, password: string): Promise<string> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'origin': SITE_URL, 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })
    expect(response.status).toBe(200)
    return response.headers.getSetCookie().find(cookie => cookie.startsWith('__Host-micelio_session='))!.split(';')[0]!
  }

  beforeEach(() => {
    mock.failures.rateLimited = false
    mock.failures.retryAfter = '42'
    mock.failures.rateLimitedReads = []
  })

  it('names the visitor, not the client-written entry, on reads and writes', async () => {
    await $fetch('/api/comments/flat', { query: { relation }, headers: visitor })
    await $fetch('/api/posts', { query: { locale: 'en' }, headers: visitor })
    const forwarded = mock.requests.map(request => request.forwarder)
    expect(forwarded.length).toBeGreaterThan(1)
    for (const entry of forwarded) expect(entry).toEqual({ secret: FORWARDER_SECRET, ip: '203.0.113.77' })
  })

  it('forwards the address on token-less auth calls too', async () => {
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'origin': SITE_URL, 'content-type': 'application/json', ...visitor },
      body: JSON.stringify({ email: 'reader@example.com' }),
    })
    const call = mock.requests.find(request => request.path === '/api/auth/forgot-password')
    expect(call?.authorization).toBeUndefined()
    expect(call?.forwarder).toEqual({ secret: FORWARDER_SECRET, ip: '203.0.113.77' })
  })

  it('does not forward for the cached site settings or the sitemap', async () => {
    await $fetch('/api/site', { query: { locale: 'en' }, headers: visitor })
    await $fetch('/sitemap.xml', { headers: visitor })
    expect(mock.siteRequests.length).toBeGreaterThan(0)
    for (const request of [...mock.siteRequests, ...mock.requests]) expect(request.forwarder).toBeUndefined()
  })

  it('passes a CMS 429 on to the browser with its Retry-After on comments', async () => {
    mock.failures.rateLimited = true
    const response = await fetch(`/api/comments?relation=${relation}`, {
      method: 'POST',
      headers: { 'origin': SITE_URL, 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.78' },
      body: JSON.stringify(commentBody),
    })
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('42')
  })

  it('passes a CMS 429 on to the browser with its Retry-After on the newsletter', async () => {
    mock.failures.rateLimited = true
    const response = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'origin': SITE_URL, 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.79' },
      body: JSON.stringify({ email: 'limited@example.com' }),
    })
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('42')
  })

  it('names the visitor on comment writes, newsletter calls and calls made with a session', async () => {
    const headers = { 'origin': SITE_URL, 'content-type': 'application/json', 'x-forwarded-for': '6.6.6.6, 203.0.113.80' }
    await fetch(`/api/comments?relation=${relation}`, { method: 'POST', headers, body: JSON.stringify(commentBody) })
    await fetch('/api/newsletter/subscribe', { method: 'POST', headers, body: JSON.stringify({ email: 'fwd@example.com' }) })
    const cookie = await signIn(testUsers.reader.username, testUsers.reader.password)
    mock.requests.length = 0
    await fetch('/api/auth/me', { headers: { cookie, 'x-forwarded-for': '203.0.113.80' } })
    const seen = (path: string, method: string) => mock.requests.find(request => request.path.startsWith(path) && request.method === method)
    expect(seen('/api/users/me', 'GET')?.forwarder).toEqual({ secret: FORWARDER_SECRET, ip: '203.0.113.80' })
    expect(seen('/api/users/me', 'GET')?.authorization).toMatch(/^Bearer mock-jwt/)
    const written = await fetch(`/api/comments?relation=${relation}`, { method: 'POST', headers, body: JSON.stringify(commentBody) })
    expect(written.status).toBeLessThan(500)
    expect(seen(`/api/comments/${relation}`, 'POST')?.forwarder).toEqual({ secret: FORWARDER_SECRET, ip: '203.0.113.80' })
    await fetch('/api/newsletter/subscribe', { method: 'POST', headers, body: JSON.stringify({ email: 'fwd2@example.com' }) })
    expect(seen(LOOKUP_PATH, 'POST')?.forwarder).toEqual({ secret: FORWARDER_SECRET, ip: '203.0.113.80' })
  })

  it('carries the visitor through the server-side render, which calls /api in process', async () => {
    const cookie = await signIn(testUsers.reader.username, testUsers.reader.password)
    mock.requests.length = 0
    const page = await fetch('/blog', { headers: { 'cookie': cookie, 'x-forwarded-for': '6.6.6.6, 203.0.113.81' } })
    expect(page.status).toBe(200)
    const articles = mock.requests.filter(request => request.path === '/api/articles')
    const me = mock.requests.filter(request => request.path === '/api/users/me')
    expect(articles.length).toBeGreaterThan(0)
    expect(me.length).toBeGreaterThan(0)
    for (const request of [...articles, ...me]) expect(request.forwarder).toEqual({ secret: FORWARDER_SECRET, ip: '203.0.113.81' })
  })

  it('ignores the internal headers on a request from outside, with a wrong nonce or none', async () => {
    const spoof = { 'x-micelio-internal-ip': '9.9.9.9', 'x-forwarded-for': '203.0.113.82' }
    await fetch(`/api/comments/flat?relation=${relation}`, { headers: { ...spoof, 'x-micelio-internal-nonce': 'guess' } })
    await fetch(`/api/comments/flat?relation=${relation}`, { headers: spoof })
    const ips = mock.requests.map(request => request.forwarder?.ip)
    expect(ips).toEqual(['203.0.113.82', '203.0.113.82'])
  })

  it('passes the Retry-After of a CMS 429 on the auth routes, clamped to an hour', async () => {
    mock.failures.rateLimited = true
    const post = (path: string, body: unknown) => fetch(path, {
      method: 'POST',
      headers: { 'origin': SITE_URL, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const login = await post('/api/auth/login', { identifier: 'someone', password: 'password-1' })
    expect(login.status).toBe(429)
    expect(login.headers.get('retry-after')).toBe('42')
    const confirm = await post('/api/auth/confirm-email', { confirmation: confirmationToken(testUsers.unconfirmed.username) })
    expect(confirm.status).toBe(429)
    expect(confirm.headers.get('retry-after')).toBe('42')
    mock.failures.retryAfter = '99999'
    const forgot = await post('/api/auth/forgot-password', { email: 'someone@example.com' })
    expect(forgot.status).toBe(429)
    expect(forgot.headers.get('retry-after')).toBe('3600')
    const comment = await fetch(`/api/comments?relation=${relation}`, {
      method: 'POST',
      headers: { 'origin': SITE_URL, 'content-type': 'application/json' },
      body: JSON.stringify(commentBody),
    })
    expect(comment.headers.get('retry-after')).toBe('3600')
    expect(comment.headers.get('cache-control')).toBe('no-store')
  })

  it('answers a CMS 429 on the post list with 429, Retry-After and no cache', async () => {
    mock.failures.rateLimitedReads = ['/api/articles']
    const response = await fetch('/api/posts?locale=en')
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('42')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers a CMS 429 on the fediverse stats routes with 429', async () => {
    mock.failures.rateLimitedReads = ['/api/fediverse/articles/']
    const one = await fetch('/api/fediverse/stats/doc-vue')
    const many = await fetch('/api/fediverse/stats?documentIds=doc-vue')
    expect([one.status, many.status]).toEqual([429, 429])
    expect(one.headers.get('retry-after')).toBe('42')
    expect(one.headers.get('cache-control')).toBe('no-store')
  })

  it('degrades search and the fediverse fallbacks without caching them while the CMS limits', async () => {
    mock.failures.rateLimitedReads = ['/api/articles/search']
    const search = await fetch('/api/search?q=vue&locale=en')
    expect(search.status).toBe(200)
    expect(await search.json()).toEqual([])
    expect(search.headers.get('cache-control')).toBe('no-store')

    mock.failures.rateLimitedReads = ['/api/fediverse/articles/']
    const ranking = await fetch('/api/posts?locale=en&sort=fediverse')
    expect(ranking.status).toBe(200)
    expect(ranking.headers.get('cache-control')).toBe('no-store')
    const stats = await fetch('/api/posts?locale=en&sort=fediverse&search=vue&content=1')
    expect(stats.status).toBe(200)
    expect(stats.headers.get('cache-control')).toBe('no-store')
  })

  it('does not forward a visitor to the CMS from a request without a socket address or valid nonce', async () => {
    // The same bytes an in-process call would carry, sent from outside with a guessed nonce
    await fetch(`/api/comments/flat?relation=${relation}`, { headers: { 'x-micelio-internal-ip': '9.9.9.9', 'x-micelio-internal-nonce': '0'.repeat(64) } })
    expect(mock.requests.map(request => request.forwarder?.ip)).not.toContain('9.9.9.9')
  })
})

// Last on purpose: the site-wide cap lives in the process and this test uses it up, so no later test may send a confirmation email
describe('the site-wide cap on confirmation emails', () => {
  it('caps the confirmation emails the site sends in an hour, whoever asks', async () => {
    // Every request comes from another address and asks for another email, so only the global cap can answer
    let blocked = 0
    for (let i = 0; i < 120; i++) {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'origin': SITE_URL, 'content-type': 'application/json', 'x-forwarded-for': `198.51.${i >> 8}.${i & 255}` },
        body: JSON.stringify({ email: `flood-${i}@example.com` }),
      })
      if (response.status === 429) blocked++
    }
    expect(blocked).toBeGreaterThanOrEqual(20)
  })
})

describe('security event logs', () => {
  type LogLine = { time: string, level: string, event: string, route?: string, requestId?: string, visitor?: string, cause?: string }

  /** The structured lines the server wrote to standard error so far (docs/security.md, "Logs"). */
  function lines(): LogLine[] {
    return useTestContext().serverLogs.flatMap(chunk => chunk.split('\n'))
      .filter(text => text.startsWith('{'))
      .flatMap((text) => {
        try {
          return [JSON.parse(text) as LogLine]
        } catch {
          return []
        }
      })
  }

  /** Runs `action`, then waits for the server's stderr to deliver the lines it wrote. */
  async function written(action: () => Promise<unknown>, wanted: string[]): Promise<LogLine[]> {
    const before = lines().length
    await action()
    await vi.waitFor(() => {
      const events = lines().slice(before).map(line => line.event)
      for (const event of wanted) expect(events).toContain(event)
    })
    return lines().slice(before)
  }

  function login(identifier: string, password: string, headers: Record<string, string> = { origin: SITE_URL }): Promise<Response> {
    return fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ identifier, password }) })
  }

  it('records a failed and a successful sign-in with the route, a request id and a hashed visitor, and nothing the visitor typed', async () => {
    const got = await written(async () => {
      await login(testUsers.reader.username, 'no-es-esta-1')
      await login(testUsers.reader.username, testUsers.reader.password)
    }, ['auth.failure', 'auth.login.success'])
    const failure = got.find(line => line.event === 'auth.failure')!
    expect(failure).toMatchObject({ level: 'warn', route: '/api/auth/login', cause: 'invalidCredentials' })
    expect(failure.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(failure.visitor).toMatch(/^[0-9a-f]{12}$/)
    expect(got.find(line => line.event === 'auth.login.success')).toMatchObject({ level: 'info', route: '/api/auth/login' })
    expect(JSON.stringify(got)).not.toMatch(/no-es-esta-1|lectora-segura-1|lectora|example\.com|mock-jwt/)
  })

  it('records a request from another origin and a draft request without a session', async () => {
    const got = await written(async () => {
      await login(testUsers.reader.username, testUsers.reader.password, { origin: 'https://otro.sitio' })
      await fetch('/api/drafts')
    }, ['authz.origin-refused', 'authz.draft-refused'])
    expect(got.find(line => line.event === 'authz.origin-refused')).toMatchObject({ level: 'warn', route: '/api/auth/login' })
    expect(got.find(line => line.event === 'authz.draft-refused')).toMatchObject({ level: 'warn', cause: 'noSession' })
    expect(JSON.stringify(got)).not.toContain('otro.sitio')
  })

  it('records a body the schema refused by field name, never by value', async () => {
    const got = await written(() => login('', 'a-secret-value'), ['input.refused'])
    const refused = got.find(line => line.event === 'input.refused')!
    expect(refused).toMatchObject({ level: 'warn', route: '/api/auth/login' })
    expect(refused.cause).toContain('identifier')
    expect(JSON.stringify(got)).not.toContain('a-secret-value')
  })

  it('records a refused newsletter token without the token', async () => {
    const got = await written(() => fetch('/api/newsletter/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'x' }) }), ['input.refused'])
    expect(got.find(line => line.event === 'input.refused')).toMatchObject({ level: 'warn', route: '/api/newsletter/unsubscribe', cause: 'invalidToken' })
    expect(JSON.stringify(got)).not.toMatch(/guessed|"x"/)
  })

  it('records a sign-out, a common password, a body over the cap and a refused query', async () => {
    const got = await written(async () => {
      await fetch('/api/auth/logout', { method: 'POST', headers: { origin: SITE_URL } })
      await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'origin': SITE_URL, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'some-code', password: 'password1234', passwordConfirmation: 'password1234' }) })
      await login('someone', 'x'.repeat(100 * 1024))
      await fetch('/api/about?locale=zz-invalid')
    }, ['auth.logout', 'auth.failure', 'input.refused'])
    expect(got.map(line => line.cause).filter(Boolean)).toEqual(expect.arrayContaining(['commonPassword', 'payloadTooLarge']))
    expect(got.find(line => line.event === 'auth.logout')).toMatchObject({ level: 'info', route: '/api/auth/logout' })
    expect(JSON.stringify(got)).not.toMatch(/password1234|zz-invalid|some-code/)
  })

  it('records a failed analytics proxy call, a dropped connection and a redirect alike, without the query', async () => {
    const statuses: number[] = []
    const got = await written(async () => {
      statuses.push((await fetch('/bd.js', { headers: { 'x-mock-redirect': '1' }, redirect: 'manual' })).status)
      statuses.push((await fetch('/api/bd?token=secret-in-query', { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-destroy': '1' }, body: '{}' })).status)
    }, ['analytics.proxy'])
    const proxy = got.filter(line => line.event === 'analytics.proxy')
    expect(proxy).toHaveLength(2)
    // The visitor's answer is a 502 either way, and the logged route has no query
    expect(statuses).toEqual([502, 502])
    expect(proxy.map(line => line.route).sort()).toEqual(['/api/bd', '/bd.js'])
    expect(proxy.every(line => line.level === 'error' && /^upstream 502/.test(line.cause ?? '') && /^[0-9a-f-]{36}$/.test(line.requestId ?? ''))).toBe(true)
    expect(JSON.stringify(got)).not.toContain('secret-in-query')
  })

  it('records a rate-limit hit with its bucket', async () => {
    const relation = 'api::article.article:doc-vue'
    const body = JSON.stringify({ author: { name: 'Bot', email: 'bot-log@example.com' }, content: 'Again.' })
    const got = await written(async () => {
      for (let i = 0; i < 11; i++) {
        await fetch(`/api/comments?relation=${relation}`, { method: 'POST', headers: { 'origin': SITE_URL, 'content-type': 'application/json', 'x-forwarded-for': '2001:db8:99:1::1' }, body })
      }
    }, ['limit.rate'])
    expect(got.find(line => line.event === 'limit.rate')).toMatchObject({ level: 'warn', cause: 'commentPerIp' })
    expect(JSON.stringify(got)).not.toMatch(/2001:db8|bot-log@example\.com/)
  })
})

describe('problem details', () => {
  const JSON_HEADERS = { 'origin': SITE_URL, 'content-type': 'application/json' }

  interface Problem {
    type: string
    title: string
    status: number
    detail: string
    code: string
    statusCode: number
    statusMessage: string
    message: string
    data?: { code?: string }
  }

  async function problemOf(response: Response): Promise<Problem> {
    expect(response.headers.get('content-type')).toMatch(/^application\/problem\+json/)
    return await response.json() as Problem
  }

  it.each([
    ['400', () => fetch('/api/posts/a%20b'), 400, 'invalidRequest'],
    ['401', () => fetch('/api/auth/change-password', { method: 'POST', headers: JSON_HEADERS, body: '{}' }), 401, 'unauthorized'],
    ['403', () => fetch('/api/auth/login', { method: 'POST', headers: { ...JSON_HEADERS, origin: 'https://other.example' }, body: '{}' }), 403, 'forbiddenOrigin'],
    ['404', () => fetch('/api/posts/unknown-slug'), 404, 'notFound'],
    ['429', () => fetch('/api/auth/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ identifier: testUsers.rateLimited.username, password: testUsers.rateLimited.password }) }), 429, 'tooManyRequests'],
    ['502', () => fetch('/api/posts/broken-article'), 502, 'upstreamUnavailable'],
    ['400 token', () => fetch('/api/newsletter/confirm', { method: 'POST', headers: JSON_HEADERS, body: '{}' }), 400, 'invalidToken'],
    ['400 unsubscribe token', () => fetch('/api/newsletter/unsubscribe', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ token: 'bad token' }) }), 400, 'invalidToken'],
    ['404 module off', () => {
      mock.modules.comments = false
      return fetch('/api/comments?relation=api::article.article:doc-vue')
    }, 404, 'notFound'],
    ['405', () => fetch('/api/posts', { method: 'PROPFIND' }), 405, 'methodNotAllowed'],
    ['413', () => fetch('/api/comments?relation=api::article.article:doc-vue', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ content: 'x'.repeat(70_000) }) }), 413, 'payloadTooLarge'],
  ] as const)('answers a %s as application/problem+json, with the legacy members', async (_name, call, status, code) => {
    const response = await call()
    expect(response.status).toBe(status)
    const body = await problemOf(response)
    expect(body).toMatchObject({ type: 'about:blank', status, statusCode: status, code })
    expect(body.title).toEqual(expect.any(String))
    expect(body.detail).toEqual(expect.any(String))
    expect(body.statusMessage).toEqual(expect.any(String))
    expect(body.message).toEqual(expect.any(String))
    if (status === 502) expect(response.headers.get('cache-control')).toBe('no-store')
    // Every error carries its code in data.code; the auth codes are also the status message
    expect(body.data?.code).toBe(code)
    if (['unauthorized', 'forbiddenOrigin', 'tooManyRequests'].includes(code)) expect(body.statusMessage).toBe(code)
    // The detail is fixed text: nothing from Strapi, no URL
    expect(body.detail).not.toContain(mock.url)
    expect(body.detail).not.toMatch(/https?:\/\/|strapi/i)
  })

  it('keeps Retry-After on a rate-limited answer', async () => {
    const relation = 'api::article.article:doc-vue'
    const send = (): Promise<Response> => fetch(`/api/comments?relation=${relation}`, { method: 'POST', headers: { ...JSON_HEADERS, 'x-forwarded-for': '2001:db8:79:1::1' }, body: JSON.stringify({ author: { name: 'Bot', email: 'bot-pd@example.com' }, content: 'Again.' }) })
    let last = await send()
    for (let i = 0; i < 12 && last.status !== 429; i++) last = await send()
    expect(last.status).toBe(429)
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await problemOf(last)).code).toBe('tooManyRequests')
  })

  it('does not copy a Strapi message into detail', async () => {
    mock.failures.about = true
    const response = await fetch('/api/about?locale=es')
    expect(response.status).toBe(502)
    const body = await problemOf(response)
    expect(body.detail).toBe('The content service failed or is unreachable.')
  })

  it('keeps the Nuxt error page for a page', async () => {
    const response = await fetch('/blog/no-such-article', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toMatch(/^text\/html/)
  })
})

describe('the built-in theme store under /_t/', () => {
  // The production build copies the store next to the server entry; the digests are what the server loaded at boot
  function digests(): { digest: string, other: string } {
    const output = useTestContext().nuxt!.options.nitro.output!.dir!
    const index = JSON.parse(readFileSync(join(output, 'server/micelio/store/index.json'), 'utf8')) as { buildTheme: string, themes: Record<string, { digest: string }> }
    return { digest: index.themes[index.buildTheme]!.digest, other: Object.entries(index.themes).find(([id]) => id !== index.buildTheme)![1].digest }
  }

  it('serves the stylesheet of the active theme, immutable and sandboxed, with its URLs under its own digest', async () => {
    const { digest } = digests()
    const response = await fetch(`/_t/${digest}/theme.css`, { headers: { 'accept-encoding': 'identity' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
    const css = await response.text()
    expect(css).toContain(`/_t/${digest}/fonts/`)
    expect(css).not.toMatch(/url\(["']?\/fonts\//)
  })

  it('negotiates brotli and serves the data file and the fonts', async () => {
    const { digest } = digests()
    const compressed = await fetch(`/_t/${digest}/theme.css`, { headers: { 'accept-encoding': 'br' } })
    expect(compressed.headers.get('content-encoding')).toBe('br')
    expect(compressed.headers.get('vary')).toBe('Accept-Encoding')
    const runtime = (await (await fetch(`/_t/${digest}/runtime.json`)).json()) as { id: string, fonts: Array<{ url: string }> }
    expect(runtime.id).toBeTruthy()
    const font = await fetch(runtime.fonts[0]!.url)
    expect(font.status).toBe(200)
    expect(font.headers.get('content-type')).toBe('font/woff2')
  })

  it('names the theme\'s own images by digest in the page, and they are served', async () => {
    const { digest } = digests()
    const html = await (await fetch('/')).text()
    const urls = [...new Set(html.match(new RegExp(`/_t/${digest}/images/[\\w./-]+`, 'g')))]
    expect(urls.length).toBeGreaterThan(0)
    expect(html).not.toMatch(/\/theme\/images\/(favicon|og)/)
    for (const url of urls) expect((await fetch(url)).status, url).toBe(200)
  })

  it('puts the theme data in the payload for the client, without the palette or the messages', async () => {
    const { digest } = digests()
    const html = await (await fetch('/')).text()
    const payload = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    expect(payload).toContain(digest)
    expect(payload).toContain('myc-theme-data')
    expect(payload).not.toContain('surface-sunken')
  })

  // The messages are also in the payload: the text the page renders is what a parser keeps once it drops every tag and script
  const withoutPayload = (html: string): string => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })

  it('renders the theme text in the language of the page, and no request sees another request\'s language', async () => {
    const english = 'Made in Bogotá, Colombia'
    const spanish = 'Hecho en Bogotá, Colombia'
    const pages = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
      const path = index % 2 === 0 ? '/' : '/es'
      return { path, html: withoutPayload(await (await fetch(path)).text()) }
    }))
    for (const { path, html } of pages) {
      expect(html, path).toContain(path === '/' ? english : spanish)
      expect(html, path).not.toContain(path === '/' ? spanish : english)
    }
    // After Spanish pages, an English one still gets English: the shared messages were not written to
    const after = withoutPayload(await (await fetch('/')).text())
    expect(after).toContain(english)
    expect(after).not.toContain(spanish)
  })

  it('sends the messages of the page\'s locale in the payload and the rest from the immutable file', async () => {
    const { digest } = digests()
    const html = await (await fetch('/es')).text()
    const payload = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    expect(payload).toContain('myc-theme-messages')
    expect(payload).not.toContain('Made in Bogotá')
    const file = (await (await fetch(`/_t/${digest}/runtime.json`)).json()) as { messages: Record<string, unknown> }
    expect(Object.keys(file.messages).sort()).toEqual(['en', 'es'])
  })

  it('answers the same empty 404 for an unknown digest, a theme this site does not serve and an unknown file', async () => {
    const { digest, other } = digests()
    const missing = [`/_t/${'0'.repeat(64)}/theme.css`, `/_t/${other}/theme.css`, `/_t/${digest}/nope.css`, `/_t/${digest}/manifest.json`, `/_t/${digest}/theme.css.br`, `/_t/${digest}/fonts/..%2ftheme.css`, '/_t/not-a-digest/theme.css', `/_t/${digest}/`, `/_t/${digest}`]
    for (const path of missing) {
      const response = await fetch(path)
      expect(response.status, path).toBe(404)
      expect(await response.text(), path).toBe('')
    }
  })
})
