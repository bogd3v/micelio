import { describe, expect, it } from 'vitest'
import { toStrapiPost } from '../app/helpers/post'
import { Locale } from '../app/interfaces/locale'
import type { RawStrapiArticle } from '../app/interfaces/strapi-post'

const article: RawStrapiArticle = {
  id: 7,
  documentId: 'doc-solarpunk',
  title: 'Qué es solarpunk',
  slug: 'que-es-solarpunk',
  description: 'Un futuro posible',
  publishedAt: '2026-09-01T00:00:00.000Z',
  readTime: 6,
  snippet: 'only in search results',
  localizations: [
    { documentId: 'doc-solarpunk', slug: 'what-is-solarpunk', locale: 'en', publishedAt: '2026-09-02T00:00:00.000Z' },
    { documentId: 'doc-solarpunk', slug: 'borrador', locale: 'en', publishedAt: null },
  ],
}

describe('toStrapiPost', () => {
  it('keeps the article fields and lists only the published translations', () => {
    expect(toStrapiPost(article)).toMatchObject({
      id: 7,
      documentId: 'doc-solarpunk',
      title: 'Qué es solarpunk',
      slug: 'que-es-solarpunk',
      description: 'Un futuro posible',
      publishedAt: '2026-09-01T00:00:00.000Z',
      readTime: 6,
      translations: [{ locale: Locale.English, slug: 'what-is-solarpunk' }],
    })
  })

  it('fills the optional collections so the article view never reads null', () => {
    const post = toStrapiPost({ ...article, seo: null, blocks: null, references: null, localizations: null })
    expect(post.seo).toBeUndefined()
    expect(post.blocks).toEqual([])
    expect(post.references).toEqual([])
    expect(post.translations).toEqual([])
  })

  it('does not carry the legacy Markdown body', () => {
    expect(toStrapiPost({ ...article, content: 'x' })).not.toHaveProperty('content')
  })

  it('drops fields that only the search and list responses carry', () => {
    expect(toStrapiPost(article)).not.toHaveProperty('snippet')
    expect(toStrapiPost(article)).not.toHaveProperty('localizations')
  })
})
