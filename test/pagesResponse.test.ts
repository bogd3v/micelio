import { describe, expect, it } from 'vitest'
import { PAGE_SECTION_COMPONENTS } from '~/interfaces/page'
import type { Page, PostListItem, RawStrapiArticle } from '~/interfaces'
import { pageSchema, pageSectionSchema } from '~/schemas/pages'
import { postListItemSchema } from '~/schemas/posts'
import { parsePage } from '../server/schemas/page'
import { publicPostCard } from '../server/lib/publicShapes'
import { pageFixtures } from '../e2e/fixtures/pages.mjs'

const context = { render: (markdown: string): string => `<p>${markdown}</p>`, siteUrl: 'https://notes.example.com', mediaOrigins: ['https://cms.example.com'] }

// The CMS cards as `postsOf` receives them, with the fields the allow-list would drop
const cmsCard = {
  id: 7,
  documentId: 'doc-7',
  title: 'Composables',
  slug: 'composables',
  content: 'dropped',
  createdAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-01-02T00:00:00.000Z',
  locale: 'en',
  category: { id: 1, name: 'Software', slug: 'software' },
  tags: [{ id: 2, name: 'Vue', slug: 'vue' }],
}

function realPage(fixture: unknown): Page {
  const page = parsePage(fixture, context)
  if (!page) throw new Error('fixture is not a page')
  // What `resolvePostLists` adds: cards through the allow-list, as `postsOf` does
  const sections = page.sections.map(section => section.__component === 'section.post-list' ? { ...section, posts: [publicPostCard(cmsCard as unknown as RawStrapiArticle)] } : section)
  return JSON.parse(JSON.stringify({ ...page, sections })) as Page
}

describe('pageSchema', () => {
  it('accepts the showcase page built by parsePage, with every section kind', () => {
    const showcase = pageFixtures.find(fixture => fixture.slug === 'muestra')
    if (!showcase) throw new Error('muestra fixture is missing')
    const parsed = pageSchema.parse(realPage(showcase))
    const kinds = new Set(parsed.sections.map(section => section.__component.replace('section.', '')))
    expect([...PAGE_SECTION_COMPONENTS].filter(kind => !kinds.has(kind))).toEqual([])
    expect(parsed.translations.length).toBeGreaterThan(0)
  })

  it('accepts every fixture page, including the scene hero and the many lists', () => {
    for (const fixture of pageFixtures) expect(pageSchema.safeParse(realPage(fixture)).error?.issues ?? []).toEqual([])
  })

  it('accepts a minimal page: no sections, no seo, no locale, no translations', () => {
    const page = parsePage({ documentId: 'p', title: 'Empty', slug: 'empty', seo: null, sections: null, localizations: null }, context)
    expect(pageSchema.parse(JSON.parse(JSON.stringify(page)))).toEqual({ documentId: 'p', title: 'Empty', slug: 'empty', sections: [], translations: [] })
  })

  it('accepts the seo of a page and its translations', () => {
    const page = parsePage({
      documentId: 'p',
      title: 'About',
      slug: 'about',
      locale: 'en',
      seo: { metaTitle: 'T', metaDescription: 'D', metaImage: { url: '/uploads/a.png' }, canonicalURL: 'https://notes.example.com/about' },
      localizations: [{ slug: 'acerca', locale: 'es' }],
    }, context)
    const parsed = pageSchema.parse(JSON.parse(JSON.stringify(page)))
    expect(parsed.seo?.canonicalURL).toBe('https://notes.example.com/about')
    expect(parsed.translations).toEqual([{ slug: 'acerca', locale: 'es' }])
  })

  it('rejects a wrong shape and an extra key', () => {
    const page = realPage(pageFixtures[0])
    expect(pageSchema.safeParse({ ...page, extra: 1 }).success).toBe(false)
    expect(pageSchema.safeParse({ ...page, locale: 7 }).success).toBe(false)
    expect(pageSchema.safeParse({ ...page, translations: undefined }).success).toBe(false)
    expect(pageSchema.safeParse({ ...page, sections: [{ __component: 'section.unknown' }] }).success).toBe(false)
    expect(pageSchema.safeParse({ ...page, sections: [{ __component: 'section.cta', variant: 'banner', title: 'Go', extra: 1 }] }).success).toBe(false)
    expect(pageSchema.safeParse({ ...page, sections: [{ __component: 'section.cta', title: 'Go' }] }).success).toBe(false)
  })

  it('has a schema for every section component, and only those', () => {
    const options = (pageSectionSchema as unknown as { options: { shape: { __component: { value: string } } }[] }).options
    expect(options.map(option => option.shape.__component.value).sort()).toEqual(PAGE_SECTION_COMPONENTS.map(kind => `section.${kind}`).sort())
  })

  it('describes the card the allow-list sends, and rejects the CMS keys it drops', () => {
    const card: PostListItem = publicPostCard(cmsCard as unknown as RawStrapiArticle)
    expect(postListItemSchema.safeParse(card).success).toBe(true)
    expect(postListItemSchema.safeParse(cmsCard).success).toBe(false)
  })
})
