import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageSection } from '~/interfaces'

const strapiFetch = vi.fn()

beforeEach(() => {
  strapiFetch.mockReset()
  vi.stubGlobal('strapiFetch', strapiFetch)
  vi.stubGlobal('logError', vi.fn())
  vi.stubGlobal('defineCachedFunction', (fn: unknown) => fn)
})

describe('post lists of a page', () => {
  it('send the fields of a card and nothing else the CMS returned', async () => {
    const extras = { provider: 'storage-provider-x', hash: 'secret-hash', folderPath: '/1', email: 'author@example.com' }
    strapiFetch.mockResolvedValue({
      data: [{
        id: 1,
        documentId: 'doc-1',
        title: 'First',
        slug: 'first',
        locale: 'en',
        content: 'legacy body',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        publishedAt: '2026-01-03T00:00:00.000Z',
        internalNote: 'draft idea',
        cover: { id: 2, url: '/uploads/cover.png', alternativeText: 'Cover', ...extras },
        author: { id: 3, name: 'Ada', ...extras },
      }],
    })
    const { resolvePostLists } = await import('../server/utils/pageSections')
    const list = { __component: 'section.post-list', count: 3 } as PageSection
    const [resolved] = await resolvePostLists([list], 'en')
    const text = JSON.stringify(resolved)
    for (const value of ['legacy body', 'draft idea', 'createdAt', 'updatedAt', ...Object.values(extras)]) expect(text).not.toContain(value)
    expect(resolved).toMatchObject({
      posts: [{ slug: 'first', title: 'First', cover: { url: '/uploads/cover.png' }, author: { name: 'Ada' } }],
    })
  })
})
