import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { RawStrapiArticle } from '~/interfaces'
import { articlePageSchema, articleSchema, categoryCountSchema, readingPathSchema, searchResultSchema, tagCountSchema } from '~/schemas/posts'
import { publicArticle, publicPostCard } from '../server/lib/publicShapes'

describe('posts response schemas', () => {
  it('accept what /api/categories and /api/tags send', () => {
    const categories = [
      { id: 1, slug: 'devops', name: 'DevOps', description: 'Operations', order: 1, featured: true, count: 2 },
      { id: 2, slug: 'garden', name: 'Garden', description: null, order: null, featured: false, count: 0 },
    ]
    expect(z.array(categoryCountSchema).parse(categories)).toEqual(categories)
    const tags = [{ slug: 'devops', name: 'DevOps', count: 2 }, { slug: 'vue', name: 'Vue', count: 1 }]
    expect(z.array(tagCountSchema).parse(tags)).toEqual(tags)
  })

  it('reject a wrong shape', () => {
    const category = { id: 1, slug: 'devops', name: 'DevOps', description: null, order: null, featured: false, count: 2 }
    expect(categoryCountSchema.safeParse(category).success).toBe(true)
    expect(categoryCountSchema.safeParse({ ...category, count: undefined }).success).toBe(false)
    expect(categoryCountSchema.safeParse({ ...category, id: '1' }).success).toBe(false)
    expect(categoryCountSchema.safeParse({ ...category, slug: null }).success).toBe(false)
    expect(tagCountSchema.safeParse({ slug: 'vue', name: 'Vue', count: 1, extra: 1 }).success).toBe(false)
    expect(categoryCountSchema.safeParse({ ...category, extra: 1 }).success).toBe(false)
    expect(tagCountSchema.safeParse({ slug: null, name: 'Vue', count: 1 }).success).toBe(false)
    expect(tagCountSchema.safeParse({ slug: 'vue', name: 'Vue', count: 0 }).success).toBe(false)
  })
})

// What the CMS sends for an article (the demo seed and the mock), with fields the allow-list drops
const cmsArticle = {
  id: 1,
  documentId: 'doc-vue',
  title: 'Vue Composables',
  slug: 'vue-composables',
  description: 'Composables deep dive',
  publishedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  createdAt: 'dropped',
  locale: 'en',
  readTime: 4,
  cover: { id: 11, documentId: 'cover', url: '/uploads/cover.png', alternativeText: null, caption: null, width: 1200, height: 630, hash: 'dropped', provider: 'local' },
  category: { id: 21, documentId: 'cat', name: 'Software', slug: 'software', createdAt: 'dropped' },
  author: { id: 31, documentId: 'author', name: 'Alex', avatar: null, email: 'dropped@example.com' },
  tags: [{ id: 51, documentId: 'tag', name: 'Vue', slug: 'vue' }],
  seo: { id: 41, metaTitle: 'Vue', metaDescription: 'Deep dive', metaImage: { url: '/uploads/og.png', alternativeText: null }, metaSocial: [] },
  coverCredit: { id: 1, kind: 'photo', author: 'Alex', authorUrl: null, source: null, sourceUrl: null, license: 'own-work', licenseUrl: null, modifications: null },
  blocks: [
    { id: 1, __component: 'shared.rich-text', body: '## Hi', html: '<h2>Hi</h2>' },
    { id: 2, __component: 'shared.quote', title: 'Rule', body: 'Grow it', html: 'Grow it' },
    { id: 3, __component: 'shared.media', file: { id: 5, documentId: 'file', url: '/uploads/a.png', alternativeText: 'A', caption: null, width: 10, height: 10 }, caption: 'Figure', credit: null },
    { id: 4, __component: 'shared.playground', runtime: 'python', code: 'print(1)', expectedOutput: '1', setup: null, caption: null },
    { id: 5, __component: 'shared.slider', items: [{ id: 1, file: { url: '/uploads/b.png' }, caption: null, credit: null }], files: [] },
    { id: 6, __component: 'about.statement', statement: 'Not for an article, but one union' },
  ],
  references: [{ id: 1, key: 'ji-2023', type: 'journal', authors: 'Ji', year: '2023', title: 'Survey', container: 'ACM', doi: '10.1145/3571730', url: null, accessedAt: null }],
  localizations: [{ id: 2, documentId: 'doc-vue', slug: 'vue-es', locale: 'es', publishedAt: '2026-01-01T00:00:00.000Z' }],
}

describe('articleSchema', () => {
  it('accepts a whole article after the allow-list of GET /api/posts/{slug}', () => {
    const article = publicArticle(cmsArticle as unknown as RawStrapiArticle)
    expect(articleSchema.parse(article)).toEqual(article)
    expect(article).not.toHaveProperty('createdAt')
  })

  it('accepts a card after the allow-list of GET /api/posts, with its snippet and no blocks', () => {
    const card = { ...publicPostCard(cmsArticle as unknown as RawStrapiArticle), snippet: '...Vue...' }
    expect(card).not.toHaveProperty('blocks')
    expect(articleSchema.parse(card)).toEqual(card)
  })

  it('accepts a page of cards and an empty page', () => {
    const page = { data: [publicPostCard(cmsArticle as unknown as RawStrapiArticle)], meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 1 } } }
    expect(articlePageSchema.parse(page)).toEqual(page)
    const empty = { data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } }
    expect(articlePageSchema.parse(empty)).toEqual(empty)
  })

  it('rejects a wrong shape, an extra key and a key the allow-list drops', () => {
    const raw = articleSchema.safeParse({ ...cmsArticle, blocks: [] })
    const unrecognized = raw.error?.issues.filter(issue => issue.code === 'unrecognized_keys').map(issue => issue.path.join('.'))
    expect(unrecognized).toEqual(expect.arrayContaining(['cover', 'category', 'author']))
    expect(articleSchema.safeParse({ ...cmsArticle, id: '1' }).success).toBe(false)
    expect(articleSchema.safeParse({ ...publicArticle(cmsArticle as unknown as RawStrapiArticle), extra: 1 }).success).toBe(false)
    expect(articleSchema.safeParse({ ...publicArticle(cmsArticle as unknown as RawStrapiArticle), blocks: [{ id: 1, __component: 'shared.unknown' }] }).success).toBe(false)
    expect(articleSchema.safeParse({ ...publicArticle(cmsArticle as unknown as RawStrapiArticle), blocks: [{ id: 1, __component: 'shared.rich-text' }] }).success).toBe(false)
    expect(articlePageSchema.safeParse({ data: [], meta: {} }).success).toBe(false)
    expect(articlePageSchema.safeParse({ data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 }, extra: 1 } }).success).toBe(false)
  })
})

describe('articleSchema with the nulls the CMS sends', () => {
  it('accepts a null seo, null SEO scalars, a media block without size or alt, and a quote without title or body', () => {
    const base = publicArticle(cmsArticle as unknown as RawStrapiArticle)
    const withNulls = {
      ...base,
      seo: { id: 1, metaTitle: 'T', metaDescription: 'D', metaImage: null, keywords: null, metaRobots: null, structuredData: null, canonicalURL: null },
      blocks: [
        { id: 1, __component: 'shared.media', file: { url: '/uploads/a.png', alternativeText: null, caption: null, width: null, height: null }, caption: null, credit: null },
        { id: 2, __component: 'shared.media', file: null },
        { id: 3, __component: 'shared.quote', title: null, body: null },
        { id: 4, __component: 'shared.rich-text', body: null },
      ],
      title: null,
      category: { id: 1, name: null, slug: null },
    }
    expect(articleSchema.parse(withNulls)).toEqual(withNulls)
    expect(articleSchema.parse({ ...base, seo: null }).seo).toBeNull()
  })

  it('accepts structured data as an object or an array, and rejects a string', () => {
    const seo = { id: 1, metaTitle: 'T', metaDescription: 'D' }
    const base = publicArticle(cmsArticle as unknown as RawStrapiArticle)
    expect(articleSchema.safeParse({ ...base, seo: { ...seo, structuredData: { '@type': 'BlogPosting' } } }).success).toBe(true)
    expect(articleSchema.safeParse({ ...base, seo: { ...seo, structuredData: [{ '@type': 'BlogPosting' }] } }).success).toBe(true)
    expect(articleSchema.safeParse({ ...base, seo: { ...seo, structuredData: 'x' } }).success).toBe(false)
  })
})

describe('searchResultSchema and readingPathSchema', () => {
  it('accept what /api/search and /api/reading-path send', () => {
    const results = [
      { documentId: 'doc-vue', title: 'Vue', slug: 'vue', description: null, publishedAt: '2026-01-01T00:00:00.000Z', category: { name: 'Software', slug: 'software' }, matchedIn: 'content', snippet: '...vue...' },
      { documentId: 'doc-x', title: 'X', slug: 'x', description: 'x', publishedAt: null, category: null, matchedIn: 'title', snippet: '' },
    ]
    expect(z.array(searchResultSchema).parse(results)).toEqual(results)
    const path = { category: 'linux', editorial: true, steps: [{ documentId: 'doc-linux', slug: 'linux', title: 'Linux' }] }
    expect(readingPathSchema.parse(path)).toEqual(path)
    expect(readingPathSchema.parse({ category: 'ia', editorial: false, steps: [] }).steps).toEqual([])
    expect(readingPathSchema.parse({ category: 'linux', editorial: true, steps: [{ documentId: 'd', slug: 's', title: null }] }).steps[0]!.title).toBeNull()
  })

  it('reject a wrong shape and an extra key', () => {
    const hit = { documentId: 'd', title: 'T', slug: 't', description: null, publishedAt: null, category: null, matchedIn: 'title', snippet: '' }
    expect(searchResultSchema.safeParse({ ...hit, matchedIn: 'body' }).success).toBe(false)
    expect(searchResultSchema.safeParse({ ...hit, extra: 1 }).success).toBe(false)
    expect(searchResultSchema.safeParse({ ...hit, snippet: undefined }).success).toBe(false)
    expect(readingPathSchema.safeParse({ category: 5, editorial: true, steps: [] }).success).toBe(false)
    expect(readingPathSchema.safeParse({ category: 'linux', editorial: true, steps: [{ documentId: 'd', slug: 's', title: 't', extra: 1 }] }).success).toBe(false)
  })
})
