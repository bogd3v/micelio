import { describe, expect, it } from 'vitest'
import type { RawStrapiArticle } from '~/interfaces'
import { isDraftState, sortDrafts } from '~/helpers/drafts'
import type { DraftListItem } from '~/interfaces/draft'
import { draftListItemSchema, draftListResponseSchema } from '~/schemas/drafts'
import { draftArticleResponseSchema, publishedVersionSchema } from '~/schemas/posts'
import { publicArticle } from '../server/lib/publicShapes'

// A row as the CMS builds it by hand (`articles.drafts` in src/constants/response-fields/articles.ts of micelio-cms)
const cmsRows = [
  { documentId: 'doc-linux', title: 'Linux hardening', slug: 'linux-hardening', locale: 'en', updatedAt: '2026-03-02T10:00:00.000Z', publishedAt: '2026-02-01T10:00:00.000Z', state: 'modified', category: { name: 'Security', slug: 'security' }, author: { name: 'Ana' } },
  { documentId: 'doc-pihole', title: 'Pi-hole', slug: null, locale: 'es', updatedAt: '2026-03-05T10:00:00.000Z', publishedAt: null, state: 'never-published', category: null, author: null },
  { documentId: 'doc-odd', title: 'Odd', slug: 'odd', locale: 'en', updatedAt: '2026-03-01T10:00:00.000Z', publishedAt: null, state: 'archived', category: { name: null, slug: null }, author: { name: null } },
]

/** What `GET /api/drafts` sends: the rows in a known state, newest edit first. */
function listAnswer(): unknown {
  const data = sortDrafts((cmsRows as unknown as DraftListItem[]).filter(row => isDraftState(row.state)))
  return JSON.parse(JSON.stringify({ data, meta: { count: data.length } }))
}

const cmsDraft = {
  id: 12,
  documentId: 'doc-linux',
  title: 'Linux hardening, second edition',
  slug: 'linux-hardening',
  locale: 'en',
  content: 'dropped',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-03-02T10:00:00.000Z',
  publishedAt: null,
  plainText: 'dropped',
  category: { id: 1, name: 'Security', slug: 'security', createdAt: 'dropped' },
  tags: [{ id: 2, name: 'Linux', slug: 'linux' }],
  blocks: [],
  references: [],
  localizations: [],
}

function draftAnswer(published: unknown): unknown {
  return JSON.parse(JSON.stringify({ article: publicArticle(cmsDraft as unknown as RawStrapiArticle), published }))
}

describe('draftListResponseSchema', () => {
  it('accepts the list the route builds: known states only, newest first, with the count', () => {
    const answer = draftListResponseSchema.parse(listAnswer())
    expect(answer.data.map(draft => draft.documentId)).toEqual(['doc-pihole', 'doc-linux'])
    expect(answer.meta.count).toBe(2)
    expect(draftListResponseSchema.safeParse({ data: [], meta: { count: 0 } }).success).toBe(true)
  })

  it('accepts a draft that was never published, has no category and no author', () => {
    expect(draftListItemSchema.safeParse(cmsRows[1]).error?.issues ?? []).toEqual([])
  })

  it('rejects an unknown state, a missing field and a key the CMS row does not have', () => {
    expect(draftListItemSchema.safeParse(cmsRows[2]).success).toBe(false)
    expect(draftListItemSchema.safeParse({ ...cmsRows[0], title: undefined }).success).toBe(false)
    expect(draftListItemSchema.safeParse({ ...cmsRows[0], content: 'a body' }).success).toBe(false)
    expect(draftListResponseSchema.safeParse({ data: [] }).success).toBe(false)
  })
})

describe('draftArticleResponseSchema', () => {
  it('accepts a draft with its published version', () => {
    const published = { slug: 'linux-hardening', updatedAt: '2026-02-01T10:00:00.000Z', publishedAt: '2026-02-01T10:00:00.000Z' }
    const answer = draftArticleResponseSchema.parse(draftAnswer(published))
    expect(answer.published).toEqual(published)
    expect(JSON.stringify(answer)).not.toContain('dropped')
  })

  it('accepts a draft that has no published version, and a version with no dates', () => {
    expect(draftArticleResponseSchema.parse(draftAnswer(null)).published).toBeNull()
    expect(publishedVersionSchema.safeParse({ slug: 'a', updatedAt: null, publishedAt: null }).success).toBe(true)
  })

  it('rejects a field the allow-list never lets through, and a published version without a slug', () => {
    const answer = draftAnswer(null) as { article: Record<string, unknown> }
    expect(draftArticleResponseSchema.safeParse({ ...answer, article: { ...answer.article, plainText: 'x' } }).success).toBe(false)
    expect(draftArticleResponseSchema.safeParse(draftAnswer({ updatedAt: null, publishedAt: null })).success).toBe(false)
  })
})
