import { describe, expect, it } from 'vitest'
import type { RawStrapiArticle, StrapiAbout } from '../app/interfaces'
import { publicAbout, publicArticle, publicPostCard } from '../server/lib/publicShapes'

const file = { id: 1, documentId: 'f', url: '/uploads/a.png', alternativeText: 'alt', width: 10, height: 20, hash: 'h', provider: 'local', folderPath: '/1', formats: { thumbnail: {} } }

describe('publicArticle', () => {
  const article = {
    id: 1,
    documentId: 'doc',
    title: 'T',
    slug: 't',
    cover: file,
    author: { id: 2, name: 'A', email: 'a@example.com', avatar: file },
    category: { id: 3, name: 'C', slug: 'c', createdAt: 'x' },
    seo: { id: 4, metaTitle: 'm', metaDescription: 'd', metaSocial: [{ id: 1 }], metaViewport: 'v', structuredData: { '@type': 'BlogPosting' } },
    blocks: [{ id: 5, __component: 'shared.media', file, caption: 'c', internal: 1 }, { id: 6, __component: 'shared.private', x: 1 }],
    createdBy: { email: 'editor@example.com' },
  } as unknown as RawStrapiArticle

  it('keeps what the article page reads', () => {
    expect(publicArticle(article)).toEqual({
      id: 1,
      documentId: 'doc',
      title: 'T',
      slug: 't',
      cover: { id: 1, documentId: 'f', url: '/uploads/a.png', alternativeText: 'alt', width: 10, height: 20 },
      author: { id: 2, name: 'A', avatar: { id: 1, documentId: 'f', url: '/uploads/a.png', alternativeText: 'alt', width: 10, height: 20 } },
      category: { id: 3, name: 'C', slug: 'c' },
      seo: { id: 4, metaTitle: 'm', metaDescription: 'd', structuredData: { '@type': 'BlogPosting' } },
      blocks: [{ id: 5, __component: 'shared.media', file: { id: 1, documentId: 'f', url: '/uploads/a.png', alternativeText: 'alt', width: 10, height: 20 }, caption: 'c' }],
    })
  })

  it('keeps when the article was last edited, which the draft strip shows, and leaves it off a card', () => {
    const dated = { ...article, updatedAt: '2026-09-27T09:15:00.000Z', createdAt: '2026-09-01T00:00:00.000Z' } as unknown as RawStrapiArticle
    expect(publicArticle(dated)).toMatchObject({ updatedAt: '2026-09-27T09:15:00.000Z' })
    expect(publicArticle(dated)).not.toHaveProperty('createdAt')
    expect(publicPostCard(dated)).not.toHaveProperty('updatedAt')
  })

  it('reduces a card to the list fields', () => {
    const card = publicPostCard({ ...article, blocks: [{ id: 1 }], content: 'body' } as unknown as RawStrapiArticle)
    expect(Object.keys(card).sort()).toEqual(['author', 'category', 'cover', 'documentId', 'id', 'seo', 'slug', 'title'])
  })
})

describe('publicAbout', () => {
  it('keeps the fields of each block and drops the unknown ones', () => {
    const about = {
      id: 1,
      documentId: 'a',
      title: 'About',
      locale: 'en',
      updatedBy: { email: 'editor@example.com' },
      blocks: [
        { id: 1, __component: 'about.contact', title: 'Hi', socials: [{ id: 1, network: 'x', handle: '@a', url: 'https://example.com', createdAt: 'z' }], secret: 1 },
        { id: 2, __component: 'about.unknown', x: 1 },
      ],
    } as unknown as StrapiAbout
    expect(publicAbout(about)).toEqual({
      id: 1,
      documentId: 'a',
      title: 'About',
      locale: 'en',
      blocks: [{ id: 1, __component: 'about.contact', title: 'Hi', socials: [{ id: 1, network: 'x', handle: '@a', url: 'https://example.com' }] }],
    })
  })
})
