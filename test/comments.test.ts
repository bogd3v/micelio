import { describe, it, expect } from 'vitest'
import type { Comment } from '../app/interfaces/comment'
import { commentAnchorId, isCommentAnchor, isCommentRelation, isFediverseComment, matchesCommentFilter, toPublicComment, toPublicComments } from '../app/helpers/comments'

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    content: 'Hello',
    blocked: false,
    blockedThread: false,
    blockReason: null,
    authorUser: null,
    removed: false,
    approvalStatus: 'APPROVED',
    // The CMS sends the email; the public shape drops it
    author: { id: 'guest-1', name: 'Ana', email: 'ana@example.com' } as Comment['author'],
    createdAt: '2026-02-03T10:00:00.000Z',
    updatedAt: '2026-02-03T10:00:00.000Z',
    related: { id: 1 },
    reports: [],
    threadOf: null,
    ...overrides,
  }
}

const fediverse = comment({
  id: 2,
  fediverseActorHandle: '@bea@mastodon.social',
  fediverseUri: 'https://mastodon.social/users/bea/statuses/1',
})

describe('toPublicComment, the parent of a reply', () => {
  const parent = { ...comment({ id: 9 }), author: { id: 'guest-9', name: 'Zoe', email: 'zoe@example.com' }, reports: [{ id: 1, reason: 'OTHER', createdAt: '2026-02-03T10:00:00.000Z' }] }

  it('keeps only the id of the parent, so its author email does not leave the server', () => {
    const result = toPublicComment(comment({ id: 10, threadOf: parent as unknown as Comment['threadOf'] }))
    expect(result.threadOf).toEqual({ id: 9 })
    expect(JSON.stringify(result)).not.toContain('zoe@example.com')
  })

  it('leaves out the reports and any field the public shape does not name', () => {
    const result = toPublicComment({ ...comment({ reports: parent.reports }), secret: 'value' } as unknown as Comment)
    expect(result.reports).toEqual([])
    expect(result).not.toHaveProperty('secret')
  })

  it('does the same for the replies of a hierarchy', () => {
    const result = toPublicComment(comment({ children: [comment({ id: 11, threadOf: parent as unknown as Comment['threadOf'] })] }))
    expect(result.children?.[0]?.threadOf).toEqual({ id: 9 })
  })

  it('keeps a top-level comment without a parent', () => {
    expect(toPublicComment(comment()).threadOf).toBeNull()
  })
})

describe('toPublicComment', () => {
  it('fills the fediverse fields with null on blog comments and drops the email', () => {
    const result = toPublicComment(comment())
    expect(result).toMatchObject({ fediverseActorHandle: null, fediverseUri: null, isAdminComment: false })
    expect(result.author).toEqual({ id: 'guest-1', name: 'Ana', avatar: null })
  })

  it('keeps the handle and the http(s) link of fediverse replies', () => {
    expect(toPublicComment(fediverse)).toMatchObject({
      fediverseActorHandle: '@bea@mastodon.social',
      fediverseUri: 'https://mastodon.social/users/bea/statuses/1',
    })
  })

  it('drops links that are not http(s) and blank handles', () => {
    expect(toPublicComment(comment({ fediverseUri: 'javascript:alert(1)', fediverseActorHandle: '  ' }))).toMatchObject({
      fediverseUri: null,
      fediverseActorHandle: null,
    })
    expect(toPublicComment(comment({ fediverseUri: 'not a url' })).fediverseUri).toBeNull()
  })

  it('marks author replies only when the backend flags them', () => {
    expect(toPublicComment(comment({ isAdminComment: true })).isAdminComment).toBe(true)
    expect(toPublicComment(comment({ isAdminComment: null })).isAdminComment).toBe(false)
  })
})

describe('toPublicComments', () => {
  it('hides pending and rejected comments, and hidden children with them', () => {
    const pending = comment({ id: 3, approvalStatus: 'PENDING' })
    const rejected = comment({ id: 4, approvalStatus: 'REJECTED' })
    const legacy = comment({ id: 5, approvalStatus: null })
    const parent = comment({ id: 6, children: [pending, comment({ id: 7 })] })
    const result = toPublicComments([comment(), pending, rejected, legacy, parent])
    expect(result.map(item => item.id)).toEqual([1, 5, 6])
    expect(result[2]?.children?.map(item => item.id)).toEqual([7])
  })
})

describe('matchesCommentFilter', () => {
  it('tells fediverse replies from blog comments', () => {
    expect(isFediverseComment(fediverse)).toBe(true)
    expect(isFediverseComment(comment({ fediverseUri: 'https://mastodon.social/@bea/1' }))).toBe(true)
    expect(isFediverseComment(comment())).toBe(false)
  })

  it('keeps every comment for all, and splits blog and fediverse', () => {
    expect(matchesCommentFilter(comment(), 'all')).toBe(true)
    expect(matchesCommentFilter(fediverse, 'all')).toBe(true)
    expect(matchesCommentFilter(comment(), 'blog')).toBe(true)
    expect(matchesCommentFilter(fediverse, 'blog')).toBe(false)
    expect(matchesCommentFilter(fediverse, 'fediverse')).toBe(true)
    expect(matchesCommentFilter(comment(), 'fediverse')).toBe(false)
  })
})

describe('isCommentRelation', () => {
  it('accepts article relations by documentId or slug', () => {
    expect(isCommentRelation('api::article.article:doc-vue')).toBe(true)
    expect(isCommentRelation('api::article.article:k2x9v0l1m3n4b5c6v7b8n9m0')).toBe(true)
  })

  it('rejects paths, other content types and non-strings', () => {
    for (const value of ['../users', 'api::article.article:../../users', 'api::article.article:a/b', 'api::article.article:a?x=1', 'api::user.user:1', 'api::article.article:', '', undefined, ['api::article.article:a']]) {
      expect(isCommentRelation(value)).toBe(false)
    }
  })
})

describe('commentAnchorId', () => {
  it('names the element by the documentId, as the CMS links a federated reply', () => {
    expect(commentAnchorId({ documentId: 'abc123' })).toBe('comment-abc123')
  })

  it('gives no id to a comment without a documentId', () => {
    expect(commentAnchorId({})).toBeUndefined()
    expect(commentAnchorId({ documentId: '' })).toBeUndefined()
  })
})

describe('isCommentAnchor', () => {
  it('accepts only a fragment that names a comment', () => {
    expect(isCommentAnchor('comment-abc123')).toBe(true)
    expect(isCommentAnchor('comment-')).toBe(false)
    expect(isCommentAnchor('comments')).toBe(false)
    expect(isCommentAnchor('naming')).toBe(false)
  })
})
