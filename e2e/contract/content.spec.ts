import { test, expect } from '@playwright/test'
import { z } from 'zod'
import { authUserResponseSchema } from '../../app/schemas/auth'
import { articlePageSchema, articleSchema, categoryCountSchema, searchResultSchema, tagCountSchema } from '../../app/schemas/posts'
import { DEMO, expectShape } from './support'

// What the frontend's read routes get from a real CMS: the keys and types the app's interfaces rely on (docs/api.md), on the demo seed.

test('site settings: the identity, the modules and the social links', async ({ request }) => {
  const response = await request.get('/api/site?locale=en')
  expect(response.status()).toBe(200)
  const site = await response.json()
  expectShape(site, { name: 'string', description: 'string', url: 'string', defaultLocale: 'string', socialLinks: 'array', modules: 'object', logo: 'object?', favicon: 'object?' })
  expect(site.name).toBe(DEMO.siteName)
  expectShape(site.modules, { newsletter: 'boolean', comments: 'boolean', accounts: 'boolean', drafts: 'boolean', fediverse: 'boolean', search: 'boolean', support: 'boolean' })
})

for (const locale of ['en', 'es'] as const) {
  test(`the post list in ${locale}: a page of articles with their category and tags`, async ({ request }) => {
    const response = await request.get(`/api/posts?locale=${locale}`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(articlePageSchema.safeParse(body).error?.issues ?? []).toEqual([])
    expectShape(body, { data: 'array', meta: 'object' })
    expectShape(body.meta.pagination, { page: 'number', pageSize: 'number', pageCount: 'number', total: 'number' })
    expect(body.meta.pagination.total).toBe(DEMO.articles[locale])
    for (const article of body.data) {
      expectShape(article, { documentId: 'string', title: 'string', description: 'string', slug: 'string', locale: 'string', publishedAt: 'string', tags: 'array', category: 'object?' })
      expect(article.locale).toBe(locale)
    }
  })
}

test('one post: the blocks, the category and its other language', async ({ request }) => {
  const response = await request.get(`/api/posts/${DEMO.firstArticle}?locale=en`)
  expect(response.status()).toBe(200)
  const article = await response.json()
  expect(articleSchema.safeParse(article).error?.issues ?? []).toEqual([])
  expectShape(article, { documentId: 'string', title: 'string', slug: 'string', locale: 'string', blocks: 'array', tags: 'array', category: 'object?', references: 'array', localizations: 'array' })
  expect(article.slug).toBe(DEMO.firstArticle)
  expect(article.blocks.length).toBeGreaterThan(0)
  for (const block of article.blocks) expectShape(block, { __component: 'string' })
  expect(article.localizations.map((entry: { locale: string }) => entry.locale)).toContain('es')
  expectShape(article.category, { slug: 'string', name: 'string' })
})

test('a post that does not exist answers 404', async ({ request }) => {
  expect((await request.get('/api/posts/no-such-article?locale=en')).status()).toBe(404)
})

for (const locale of ['en', 'es'] as const) {
  test(`a page with sections in ${locale}`, async ({ request }) => {
    const response = await request.get(`/api/pages/${DEMO.page[locale]}?locale=${locale}`)
    expect(response.status()).toBe(200)
    const page = await response.json()
    expectShape(page, { documentId: 'string', title: 'string', slug: 'string', locale: 'string', sections: 'array' })
    expect(page.sections.length).toBeGreaterThan(0)
    for (const section of page.sections) expect(section.__component).toMatch(/^section\./)
    expect(page.sections[0].__component).toBe('section.hero')
  })
}

test('a page that does not exist answers 404', async ({ request }) => {
  expect((await request.get('/api/pages/no-such-page?locale=en')).status()).toBe(404)
})

test('the about page: blocks with their rendered html', async ({ request }) => {
  const response = await request.get('/api/about?locale=en')
  expect(response.status()).toBe(200)
  const about = await response.json()
  expectShape(about, { documentId: 'string', title: 'string', locale: 'string', blocks: 'array' })
  const richText = about.blocks.find((block: { __component: string }) => block.__component === 'shared.rich-text')
  expectShape(richText, { body: 'string', html: 'string' })
})

// No reading-path check: its category must be one of the five slugs of the theme contract, and the demo categories (garden, kitchen) are not
test('search finds an article by its title', async ({ request }) => {
  const response = await request.get('/api/search?q=compost&locale=en')
  expect(response.status()).toBe(200)
  const results = await response.json()
  expect(Array.isArray(results)).toBe(true)
  expect(z.array(searchResultSchema).safeParse(results).error?.issues ?? []).toEqual([])
  const hit = results.find((result: { slug: string }) => result.slug === 'compost-in-a-small-space')
  expectShape(hit, { documentId: 'string', slug: 'string', title: 'string', description: 'string', publishedAt: 'string', matchedIn: 'string', snippet: 'string', category: 'object?' })
})

test('categories and tags with their article counts', async ({ request }) => {
  const categories = await (await request.get('/api/categories?locale=en')).json()
  expect(z.array(categoryCountSchema).safeParse(categories).error?.issues ?? []).toEqual([])
  for (const category of categories) expectShape(category, { id: 'number', slug: 'string', name: 'string', count: 'number' })
  for (const [slug, count] of Object.entries(DEMO.categories)) expect(categories.find((category: { slug: string }) => category.slug === slug)?.count).toBe(count)

  const tags = await (await request.get('/api/tags?locale=en')).json()
  expect(z.array(tagCountSchema).safeParse(tags).error?.issues ?? []).toEqual([])
  for (const tag of tags) expectShape(tag, { slug: 'string', name: 'string', count: 'number' })
  for (const [slug, count] of Object.entries(DEMO.tags)) expect(tags.find((tag: { slug: string }) => tag.slug === slug)?.count).toBe(count)
})

// The schemas of app/schemas/ are what docs/openapi.json publishes: the real answer must satisfy them. The newsletter and fediverse modules are off
// on the contract server (no SMTP and no fediverse configuration, `effectiveModules`), and the signed-in routes need a session, so only the session
// check, which answers without a cookie, is parsed here
test('the session check without a session answers user null, as its response schema says', async ({ request }) => {
  const response = await request.get('/api/auth/me')
  expect(response.status()).toBe(200)
  expect(authUserResponseSchema.parse(await response.json())).toEqual({ user: null })
})
