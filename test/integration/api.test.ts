import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { $fetch, fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import type { RawStrapiArticle } from '~/interfaces/strapi-post'
import type { Page, PageSection } from '~/interfaces/page'
import type { StrapiRichText } from '~/interfaces/strapi-blocks'
import { Category } from '~/interfaces/design'
import { startMockStrapi } from './mock-strapi'
import { MOCK_TRACKER_SCRIPT, startMockUmami } from './mock-umami'
import { resetCode, testUsers } from '../../e2e/fixtures/auth.mjs'
import { pageFixtures } from '../../e2e/fixtures/pages.mjs'
import { contrastRatio, parseHex } from '~/helpers/color'
import { inlineScripts } from '~/helpers/securityHeaders'

const SITE_URL = 'https://bogdev.test'

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
  mock.theme.value = null
  mock.homePage.value = null
  for (const module of Object.keys(mock.modules) as (keyof typeof mock.modules)[]) mock.modules[module] = true
  umami.requests.length = 0
})

describe('/api/categories', () => {
  it('returns the five redesign categories in order, including empty ones, and hides unknown empty ones', async () => {
    const result = await $fetch<Array<{ slug: string | null, name: string, count: number }>>('/api/categories', { query: { locale: 'en' } })
    expect(result.map(category => [category.slug, category.count])).toEqual([
      [Category.Privacy, 0],
      [Category.Diy, 0],
      [Category.Ai, 0],
      [Category.Software, 1],
      [Category.Linux, 1],
    ])
  })

  it('counts articles of the requested locale only', async () => {
    const result = await $fetch<Array<{ slug: string | null, count: number }>>('/api/categories', { query: { locale: 'es' } })
    expect(result.find(category => category.slug === Category.Software)?.count).toBe(1)
    expect(result.find(category => category.slug === Category.Linux)?.count).toBe(0)
  })
})

describe('/api/posts category filter', () => {
  it('filters by category slug', async () => {
    const result = await $fetch<{ data: Array<{ slug: string }> }>('/api/posts', { query: { locale: 'en', category: Category.Linux } })
    expect(result.data.map(post => post.slug)).toEqual(['linux-server-hardening-guide'])
    const strapiRequests = mock.requests.filter(request => request.method === 'GET' && request.path === '/api/articles')
    expect(getNestedValue(strapiRequests[strapiRequests.length - 1].query, ['filters', 'category', 'slug', '$eq'])).toBe(Category.Linux)
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
    expect(articles?.query.filters).toEqual({ documentId: { $in: ['doc-linux'] } })

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
    const result = await $fetch<{ data: Array<{ slug: string }> }>('/api/posts', { query: { locale: 'en', search: 'vue', category: Category.Software } })
    expect(result.data.map(post => post.slug)).toEqual(['understanding-vue-composables'])
    const strapiRequests = mock.requests.filter(request => request.method === 'GET' && request.path === '/api/articles')
    expect(getNestedValue(strapiRequests[strapiRequests.length - 1].query, ['filters', 'title', '$containsi'])).toBe('vue')
  })

  it('ignores searches shorter than three letters', async () => {
    await $fetch('/api/posts', { query: { locale: 'en', search: 'vu' } })
    const strapiRequests = mock.requests.filter(request => request.method === 'GET' && request.path === '/api/articles')
    expect(getNestedValue(strapiRequests[strapiRequests.length - 1].query, ['filters', 'title', '$containsi'])).toBeUndefined()
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

  it('rejects unknown categories without calling Strapi', async () => {
    await expect($fetch('/api/reading-path', { query: { category: 'cooking' } })).rejects.toMatchObject({ response: { status: 400 } })
    await expect($fetch('/api/reading-path')).rejects.toMatchObject({ response: { status: 400 } })
    expect(mock.requests.some(item => item.path === '/api/articles')).toBe(false)
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
    expect(english.body).toContain('<title>Micelio - Personal Blog</title>')
    expect(english.body).toContain('<generator>Micelio</generator>')
    expect(english.body).toContain(`<atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>`)
    expect(items(english.body)).toEqual(['Understanding Vue Composables', 'Linux Server Hardening Guide'])

    const spanish = await feed('/es/feed.xml')
    const legacy = await feed('/feed.xml?lang=es')
    expect(spanish.status).toBe(200)
    expect(spanish.body.replace(/<lastBuildDate>.*<\/lastBuildDate>/, '')).toBe(legacy.body.replace(/<lastBuildDate>.*<\/lastBuildDate>/, ''))
    expect(spanish.body).toContain('<title>Micelio - Personal Blog (Español)</title>')
    expect(items(spanish.body)).toEqual(['Guía de Vue Composables'])
  })

  it('serves one feed per category with only its articles, in each language', async () => {
    const linux = await feed('/feed/linux.xml')
    expect(linux.status).toBe(200)
    expect(linux.type).toBe('application/rss+xml; charset=utf-8')
    expect(linux.cache).toBe('public, s-maxage=1800, stale-while-revalidate=3600')
    expect(linux.body).toContain('<title>Micelio - Linux and open source</title>')
    expect(linux.body).toContain('<description>Micelio articles about Linux and open source, from Bogotá, Colombia.</description>')
    expect(linux.body).toContain(`<link>${SITE_URL}/blog?category=linux</link>`)
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

  it('names the feed from app.config.ts when Strapi has no site-setting', async () => {
    mock.failures.site = true
    const english = await feed('/feed.xml')
    expect(english.status).toBe(200)
    expect(english.body).toContain('<title>BogDev - Personal Blog</title>')
    expect(english.body).toContain('<generator>BogDev</generator>')
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
        category: { name: 'Desarrollo de software', slug: Category.Software },
        matchedIn: 'title',
        snippet: 'Guía de Vue Composables',
      },
      {
        documentId: 'doc-vue',
        title: 'Understanding Vue Composables',
        slug: 'understanding-vue-composables',
        description: 'A deep dive into writing reusable Vue composables.',
        publishedAt: '2026-02-01T10:00:00.000Z',
        category: { name: 'Desarrollo de software', slug: Category.Software },
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
    expect(result.category?.slug).toBe(Category.Software)
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
    expect(getNestedValue(upstream[upstream.length - 1].query, ['populate', 'references'])).toBe('true')
  })

  it('asks Strapi for the cover credit and the credit of every figure', async () => {
    await $fetch('/api/posts/understanding-vue-composables', { query: { locale: 'en' } })
    const upstream = mock.requests.filter(request => request.path === '/api/articles')
    const query = upstream[upstream.length - 1].query
    expect(getNestedValue(query, ['populate', 'coverCredit'])).toBe('true')
    expect(getNestedValue(query, ['populate', 'blocks', 'on', 'shared.media', 'populate'])).toEqual({ file: 'true', credit: 'true' })
    expect(getNestedValue(query, ['populate', 'blocks', 'on', 'shared.slider', 'populate', 'items', 'populate'])).toEqual({ file: 'true', credit: 'true' })
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

  it('answers 502 when Strapi fails', async () => {
    await expect($fetch('/api/posts/broken-article')).rejects.toMatchObject({ response: { status: 502 } })
  })

  it('returns the slug and language of each translation', async () => {
    const result = await $fetch<RawStrapiArticle>('/api/posts/guia-vue-composables', { query: { locale: 'es' } })
    expect(result.localizations).toEqual([
      { id: 1, documentId: 'doc-vue', slug: 'understanding-vue-composables', locale: 'en', publishedAt: '2026-02-01T10:00:00.000Z' },
    ])
    const upstream = mock.requests.filter(request => request.path === '/api/articles')
    expect(getNestedValue(upstream[upstream.length - 1].query, ['populate', 'localizations', 'fields'])).toEqual(['slug', 'locale', 'publishedAt'])
  })
})

describe('/sitemap.xml', () => {
  async function sitemap(): Promise<string> {
    const response = await fetch('/sitemap.xml')
    expect(response.status).toBe(200)
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

describe('/api/about', () => {
  it('answers 502 with the Strapi message when Strapi rejects the query', async () => {
    mock.failures.about = true
    await expect($fetch('/api/about', { query: { locale: 'es' } })).rejects.toMatchObject({
      response: { status: 502 },
      data: { message: 'Invalid key about.profile at blocks.on.about.profile' },
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
        seo: { populate: '*' },
        localizations: { fields: ['slug', 'locale'] },
        sections: {
          on: {
            'section.hero': { populate: { primaryLink: 'true', secondaryLink: 'true', media: 'true' } },
            'section.feature-grid': { populate: { items: { populate: { icon: 'true' } } } },
            'section.media-showcase': { populate: { media: 'true', link: 'true' } },
            'section.logo-cloud': { populate: { logos: { populate: { image: 'true' } } } },
            'section.testimonials': { populate: { items: { populate: { avatar: 'true' } } } },
            'section.pricing': { populate: { plans: { populate: { link: 'true' } } } },
            'section.post-list': { populate: { category: { fields: ['slug'] }, tag: { fields: ['slug'] } } },
            'section.gallery': { populate: { images: 'true' } },
            'section.scene': { populate: { model: 'true', poster: 'true' } },
          },
        },
      },
    })
    const populate = request.query.populate as { sections: { on: Record<string, unknown> } }
    expect(Object.keys(populate.sections.on)).toEqual(COMPONENTS)
  })

  it('resolves the post list on the server', async () => {
    const page = await $fetch<PageBody>('/api/pages/showcase', { query: { locale: 'en' } })
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

    const late = { documentId: 'page-late', title: 'Late', slug: 'late-page', locale: 'en', seo: null, sections: [], localizations: [] }
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
      author: { name: 'Grace', url: 'https://bogdev.com.co/about' },
      logo: { url: '/uploads/logo.svg', alternativeText: 'Micelio', width: 120, height: 40 },
      socialLinks: [{ network: 'codeberg', url: 'https://codeberg.org/micelio' }],
      contactEmail: 'hola@micelio.test',
      privacyContactEmail: 'gx_alejandro@hotmail.com',
      supportHandle: 'ale9420',
      modules: { comments: true, newsletter: true },
    })
    expect(mock.siteRequests).toEqual([expect.objectContaining({
      path: '/api/site-setting',
      query: { populate: { author: 'true', logo: 'true', favicon: 'true', defaultOgImage: 'true', socialLinks: 'true', modules: 'true', theme: { populate: '*' }, homePage: { fields: ['slug'] } }, locale: 'es' },
      authorization: 'Bearer test-api-token',
    })])
  })

  it('falls back field by field when a value is empty', async () => {
    const site = await $fetch<{ description: string }>('/api/site', { query: { locale: 'en' } })
    expect(site.description).toBe('Personal blog about AI, Software, Linux and more')
  })

  it('answers with app.config\'s values, cached briefly, when Strapi fails', async () => {
    mock.failures.site = true
    const response = await fetch('/api/site')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=30, stale-while-revalidate=60')
    expect(await response.json()).toMatchObject({ name: 'BogDev', url: 'https://bogdev.com.co', modules: { comments: true } })
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
    expect(file.headers.get('content-security-policy')).toBe('default-src \'none\'; style-src \'unsafe-inline\'; sandbox')
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

  it('prunes hidden comments from the hierarchy, children included', async () => {
    const response = await $fetch<Array<{ id: number, children?: Array<{ id: number }> }>>('/api/comments', { query: { relation } })
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
    for (const headers of [{ origin: 'https://otro.sitio' }, {}]) {
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
  const subscribe = (body: unknown, extra: Record<string, string> = {}) =>
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
    const writes = mock.requests.filter(request => request.method !== 'GET' && request.path.startsWith('/api/subscribers'))
    expect(writes).toEqual([])
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
    expect(lastPost?.body?.data?.confirmationToken).toBeTruthy()
    expect(lastPost?.body?.data?.unsubscribeToken).toMatch(/^[\w-]{43}$/)
    expect(lastPost?.body?.data).not.toHaveProperty('locale')
  })

  it('stores the Spanish language and treats any other locale as English', async () => {
    await subscribe({ email: 'es@example.com', locale: 'es' }).catch(() => null)
    await subscribe({ email: 'fr@example.com', locale: 'fr' }).catch(() => null)
    const languages = mock.requests
      .filter(request => request.method === 'POST' && request.path === '/api/subscribers')
      .map(request => [request.body?.data?.email, request.body?.data?.language])
    expect(languages).toEqual([['es@example.com', 'es'], ['fr@example.com', 'en']])
  })

  it('limits confirmation emails to the same address, whatever the visitor', async () => {
    for (let i = 0; i < 3; i++) {
      await subscribe({ email: 'Target@Example.com' }, { 'x-forwarded-for': `198.51.100.${i}` }).catch(() => null)
    }
    await expect(subscribe({ email: 'target@example.com' }, { 'x-forwarded-for': '198.51.100.9' })).rejects.toMatchObject({ response: { status: 429 } })
    const created = mock.requests.filter(request => request.method === 'POST' && request.body?.data?.email === 'target@example.com')
    expect(created).toHaveLength(3)
  })

  it('limits how many subscriptions one visitor can request', async () => {
    const visitor = { 'x-forwarded-for': '198.51.100.50' }
    for (let i = 0; i < 10; i++) {
      await subscribe({ email: `reader${i}@example.com` }, visitor).catch(() => null)
    }
    await expect(subscribe({ email: 'reader10@example.com' }, visitor)).rejects.toMatchObject({ response: { status: 429 } })
  })
})

describe('/api/newsletter/confirm', () => {
  it('confirms the subscriber, keeps an unsubscribe token and succeeds even if the welcome email fails', async () => {
    const result = await $fetch('/api/newsletter/confirm', { query: { token: 'confirmation-token-to-confirm-0001' } })
    expect(result).toMatchObject({ success: true, alreadyConfirmed: false })
    const update = mock.requests.find(request => request.method === 'PUT' && request.path === '/api/subscribers/sub-to-confirm')
    expect(update?.body?.data).toMatchObject({ confirmed: true })
    expect(update?.body?.data).not.toHaveProperty('confirmationToken')
    expect(update?.body?.data?.unsubscribeToken).toMatch(/^[\w-]{43}$/)
  })

  it('answers a reopened link as already confirmed without writing again', async () => {
    const result = await $fetch('/api/newsletter/confirm', { query: { token: 'confirmation-token-to-confirm-0001' } })
    expect(result).toMatchObject({ success: true, alreadyConfirmed: true })
    expect(mock.requests.filter(request => request.method !== 'GET')).toEqual([])
  })

  it('answers 404 for an unknown or malformed token', async () => {
    for (const token of ['confirmation-token-unknown-0001', 'bad token']) {
      await expect($fetch('/api/newsletter/confirm', { query: { token } })).rejects.toMatchObject({ response: { status: 404 } })
    }
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
    return response.headers.getSetCookie().find(cookie => cookie.startsWith('bd_session=')) ?? ''
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
    expect(cookie).toMatch(/^bd_session=mock-jwt-102;/)
    expect(cookie).toContain('Max-Age=604800')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
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
    const expired = await fetch('/api/auth/me', { headers: { cookie: 'bd_session=mock-jwt-999' } })
    expect(await expired.json()).toEqual({ user: null })
    expect(sessionCookie(expired)).toContain('Max-Age=0')
  })

  it('signs out by clearing the cookie', async () => {
    const response = await post('/api/auth/logout', {})
    expect(response.status).toBe(200)
    expect(sessionCookie(response)).toMatch(/^bd_session=;.*Max-Age=0/)
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
    const cookie = login.headers.getSetCookie().find(value => value.startsWith('bd_session='))!.split(';')[0]!
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
    return response.headers.getSetCookie().find(value => value.startsWith('bd_session='))!.split(';')[0]!
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
    await $fetch('/api/newsletter/confirm', { query: { token: 'confirmation-token-unknown-0002' } }).catch(() => null)
    const paths = ['/api/articles', '/api/tags', '/api/comments/api::article.article:doc-vue/flat', '/api/subscribers']
    for (const path of paths) {
      const request = mock.requests.find(recorded => recorded.path === path)
      expect(request, path).toBeDefined()
      expect(request?.authorization, path).toBe(API_TOKEN)
    }
  })

  it('keeps the public fediverse endpoints and the sitemap anonymous', async () => {
    await $fetch('/api/fediverse/stats', { query: { documentIds: 'doc-vue' } }).catch(() => null)
    await $fetch('/api/posts', { query: { sort: 'fediverse' } }).catch(() => null)
    await fetch('/sitemap.xml')
    const anonymous = mock.requests.filter(request => request.path.startsWith('/api/fediverse/') || request.query.fields !== undefined)
    expect(anonymous.length).toBeGreaterThan(0)
    expect(anonymous.every(request => request.authorization === undefined)).toBe(true)
  })
})

describe('theme fonts', () => {
  it('preloads each font of the theme exactly once', async () => {
    const html = await $fetch<string>('/')
    for (const file of ['archivo-latin-var.woff2', 'jetbrains-mono-latin-var.woff2']) {
      expect(html.split(`<link rel="preload" href="/fonts/${file}"`)).toHaveLength(2)
    }
  })

  it('serves /fonts/ like other static assets', async () => {
    const font = await fetch('/fonts/archivo-latin-var.woff2')
    const asset = await fetch('/theme/images/bogdev.svg')
    expect(font.status).toBe(200)
    expect(font.headers.get('content-type')).toBe('font/woff2')
    for (const header of ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy']) {
      expect(font.headers.get(header)).toBe(asset.headers.get(header))
    }
  })

  it('serves fonts and their licenses from fonts/, with the sandbox CSP of the theme\'s static assets', async () => {
    const csp = 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox'
    expect((await fetch('/fonts/archivo-latin-var.woff2')).headers.get('content-security-policy')).toBe(csp)
    for (const license of ['OFL-Archivo.txt', 'OFL-JetBrainsMono.txt']) {
      const response = await fetch(`/fonts/${license}`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('content-security-policy')).toBe(csp)
    }
    expect((await fetch('/fonts/archivo-latin-var.woff2.map')).status).toBe(404)
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
      for (const needle of ['bd-specimen', 'ThemeSpecimenPage', 'Every component, state and layout region']) {
        expect(source.includes(needle), `${file} contains ${needle}`).toBe(false)
      }
    }
  })
})
