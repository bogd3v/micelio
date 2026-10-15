import { describe, expect, it } from 'vitest'
import { aboutSchema } from '~/schemas/blocks'
import { publicAbout } from '../server/lib/publicShapes'
import type { StrapiAbout } from '~/interfaces'
import { aboutBlocks } from '../e2e/fixtures/about.mjs'

// The mock CMS answer of e2e/, reduced by the route's allow-list as `GET /api/about` does
const about = publicAbout({
  id: 1,
  documentId: 'about',
  title: 'About',
  locale: 'en',
  blocks: aboutBlocks('en'),
  seo: { id: 43, metaTitle: 'About', metaDescription: 'About the author', metaImage: { url: '/uploads/about-og.png' }, createdAt: 'dropped' },
  createdAt: 'dropped',
} as unknown as StrapiAbout)

describe('aboutSchema', () => {
  it('accepts what GET /api/about sends, with every About block of the fixture', () => {
    const parsed = aboutSchema.parse(about)
    expect(parsed.blocks.map(block => block.__component)).toEqual(expect.arrayContaining(['about.profile', 'about.projects', 'about.contact']))
    expect(parsed.blocks).toHaveLength(about.blocks.length)
  })

  it('accepts the null SEO and title the CMS sends for an empty component and an untitled page', () => {
    const block = { id: 1, __component: 'shared.rich-text', body: 'A **page**.', html: '<p>A <strong>page</strong>.</p>' }
    expect(aboutSchema.parse({ id: 1, documentId: 'a', title: null, locale: 'en', seo: null, blocks: [block] }).blocks).toEqual([block])
  })

  it('rejects an unknown block, a wrong category and an extra key', () => {
    expect(aboutSchema.safeParse({ ...about, blocks: [{ id: 1, __component: 'about.unknown' }] }).success).toBe(false)
    expect(aboutSchema.safeParse({ ...about, blocks: [{ id: 1, __component: 'about.topics', topics: [{ id: 1, category: 'cooking', title: 'x' }] }] }).success).toBe(false)
    expect(aboutSchema.safeParse({ ...about, extra: 1 }).success).toBe(false)
    expect(aboutSchema.safeParse({ ...about, title: undefined }).success).toBe(false)
  })
})
