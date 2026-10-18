import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Comment } from '~/interfaces/comment'
import { toPublicComment, toPublicComments } from '~/helpers/comments'
import { commentSchema, commentsResponseSchema, commentTreeSchema } from '~/schemas/comments'

// A comment as the comments plugin sends it (src/constants/response-fields/accounts.ts of micelio-cms): the author's email, the whole
// parent in `threadOf`, the reports and the plugin internals, all of which `toPublicComment` must leave behind
const cmsComment = {
  id: 201,
  documentId: 'comment-blog',
  content: 'Great introduction to composables.',
  blocked: false,
  blockedThread: false,
  blockReason: null,
  removed: false,
  approvalStatus: 'APPROVED',
  isAdminComment: false,
  author: { id: 'guest-1', name: 'Ana Reader', email: 'ana@example.com' },
  createdAt: '2026-02-03T10:00:00.000Z',
  updatedAt: '2026-02-03T10:00:00.000Z',
  related: 'api::article.article:doc-vue',
  threadOf: null,
  gotThread: false,
  threadFirstItemId: null,
  reports: [{ id: 1, reason: 'OTHER', content: 'a reader wrote this', createdAt: '2026-02-03T10:00:00.000Z' }],
}

const cmsReply = {
  ...cmsComment,
  id: 203,
  documentId: 'comment-author',
  isAdminComment: true,
  author: { id: 1, name: 'Alejandro', email: 'admin@example.com', avatar: 'https://cdn.example.com/a.png' },
  threadOf: { ...cmsComment, id: 202, author: { id: 'guest-2', name: 'Bea', email: 'bea@example.org' } },
  fediverseActorHandle: '@bea@mastodon.social',
  fediverseUri: 'https://mastodon.social/users/bea/statuses/1',
}

/** What the route sends: public, and through JSON as the browser receives it. */
function sent<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

function publicOf(comment: unknown): unknown {
  return sent(toPublicComment(comment as Comment))
}

describe('commentSchema', () => {
  it('accepts a flat comment and a reply, as toPublicComment builds them', () => {
    expect(commentSchema.safeParse(publicOf(cmsComment)).error?.issues ?? []).toEqual([])
    const reply = commentSchema.parse(publicOf(cmsReply))
    expect(reply.threadOf).toEqual({ id: 202 })
    expect(reply.reports).toEqual([])
    expect(reply.author).toEqual({ id: 1, name: 'Alejandro', avatar: 'https://cdn.example.com/a.png' })
  })

  it('accepts the comment just posted, which has no fediverse data and may await moderation', () => {
    const posted = { ...cmsComment, id: 207, approvalStatus: 'PENDING', author: { id: 'guest-5f3c', name: 'Dani', email: 'dani@example.com' }, related: undefined }
    expect(commentSchema.safeParse(publicOf(posted)).error?.issues ?? []).toEqual([])
  })

  it('accepts a related article as a relation string or as an object', () => {
    expect(commentSchema.safeParse(publicOf({ ...cmsComment, related: { id: 5, documentId: 'doc' } })).success).toBe(true)
    expect(commentSchema.safeParse({ ...(publicOf(cmsComment) as object), related: 5 }).success).toBe(false)
  })

  it('accepts replies nested at any depth', () => {
    const third = { ...cmsComment, id: 3, children: [] }
    const second = { ...cmsComment, id: 2, children: [third] }
    const first = { ...cmsComment, id: 1, children: [second] }
    const parsed = commentSchema.parse(publicOf(first))
    expect(parsed.children?.[0]?.children?.[0]?.id).toBe(3)
  })

  it('checks the replies too: a wrong key deep in the tree fails', () => {
    const tree = publicOf({ ...cmsComment, children: [{ ...cmsComment, id: 2, children: [] }] }) as { children: Array<Record<string, unknown>> }
    tree.children[0]!.content = 7
    expect(commentSchema.safeParse(tree).success).toBe(false)
    const withEmail = publicOf({ ...cmsComment, children: [{ ...cmsComment, id: 2, children: [] }] }) as { children: Array<{ author: Record<string, unknown> }> }
    withEmail.children[0]!.author.secret = 'x'
    expect(commentSchema.safeParse(withEmail).success).toBe(false)
  })

  it('rejects a missing field, a wrong type and a key the public shape never has', () => {
    const base = publicOf(cmsComment) as Record<string, unknown>
    const { content: _content, ...withoutContent } = base
    expect(commentSchema.safeParse(withoutContent).success).toBe(false)
    expect(commentSchema.safeParse({ ...base, blocked: 'no' }).success).toBe(false)
    expect(commentSchema.safeParse({ ...base, gotThread: false }).success).toBe(false)
    expect(commentSchema.safeParse({ ...base, threadOf: { id: 1, content: 'whole parent' } }).success).toBe(false)
    expect(commentSchema.safeParse({ ...base, reports: [{ id: 1 }] }).success).toBe(false)
  })

  it('does not describe a field the public shape drops from the author', () => {
    const parsed = commentSchema.parse(publicOf(cmsComment))
    expect(JSON.stringify(parsed)).not.toContain('ana@example.com')
  })
})

describe('commentTreeSchema and commentsResponseSchema', () => {
  it('accept the hierarchy as a bare array, hidden comments pruned', () => {
    const hidden = { ...cmsComment, id: 9, approvalStatus: 'REJECTED' }
    const tree = sent(toPublicComments([{ ...cmsComment, children: [cmsReply, hidden] }, hidden] as unknown as Comment[]))
    const parsed = commentTreeSchema.parse(tree)
    expect(parsed.map(comment => comment.id)).toEqual([201])
    expect(parsed[0]?.children?.map(comment => comment.id)).toEqual([203])
    expect(commentTreeSchema.safeParse({ data: [] }).success).toBe(false)
    expect(commentTreeSchema.safeParse([]).success).toBe(true)
  })

  it('accept the flat list with the pagination beside the data', () => {
    const data = sent(toPublicComments([cmsComment, cmsReply] as unknown as Comment[]))
    const body = { data, pagination: { page: 1, pageSize: 10, pageCount: 1, total: 2 } }
    expect(commentsResponseSchema.safeParse(body).error?.issues ?? []).toEqual([])
    expect(commentsResponseSchema.safeParse({ data: [] }).success).toBe(true)
  })

  it('reject a wrong pagination or an extra key of the envelope', () => {
    expect(commentsResponseSchema.safeParse({ data: [], pagination: { page: 0, pageSize: 10, pageCount: 1, total: 0 } }).success).toBe(false)
    expect(commentsResponseSchema.safeParse({ data: [], extra: 1 }).success).toBe(false)
    expect(commentsResponseSchema.safeParse({ data: [{}] }).success).toBe(false)
  })
})

describe('the comment schemas in the OpenAPI document', () => {
  it('refers to itself with a $ref instead of unfolding the replies', () => {
    const { schemas } = z.toJSONSchema(z.registry<{ id: string }>().add(commentSchema, { id: 'Comment' }), { uri: id => `#/components/schemas/${id}` })
    const comment = schemas.Comment as unknown as { properties: { children: { items: unknown } }, additionalProperties: unknown }
    expect(comment.properties.children.items).toEqual({ $ref: '#/components/schemas/Comment' })
    expect(comment.additionalProperties).toBe(false)
  })
})
