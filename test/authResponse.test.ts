import { describe, expect, it } from 'vitest'
import { toPublicUser } from '~/helpers/auth'
import { authUserResponseSchema, okResponseSchema } from '~/schemas/auth'
import { responseSchema } from '~/schemas/response'
import { z } from 'zod'
import type { Comment } from '~/interfaces/comment'

describe('auth response schemas', () => {
  it('accept what the routes send', () => {
    expect(okResponseSchema.parse({ ok: true })).toEqual({ ok: true })
    expect(authUserResponseSchema.parse({ user: null })).toEqual({ user: null })
    const user = toPublicUser({ id: 1, username: 'alejandro', email: 'alejandro@example.com', role: { type: 'editor' }, createdAt: '2026-01-15T15:00:00.000Z' })
    expect(authUserResponseSchema.parse({ user })).toEqual({ user })
    expect(authUserResponseSchema.parse({ user: toPublicUser({ id: 2, username: 'lectora', email: 'l@example.com' }) }).user?.createdAt).toBeNull()
  })

  it('reject a wrong shape', () => {
    expect(okResponseSchema.safeParse({ ok: false }).success).toBe(false)
    expect(authUserResponseSchema.safeParse({}).success).toBe(false)
    expect(okResponseSchema.safeParse({ ok: true, extra: 1 }).success).toBe(false)
    expect(authUserResponseSchema.safeParse({ user: null, extra: 1 }).success).toBe(false)
    expect(authUserResponseSchema.safeParse({ user: { username: 'a', email: 'a@example.com', role: 'admin', createdAt: null } }).success).toBe(false)
  })
})

describe('responseSchema', () => {
  it('returns the schema unchanged when it matches the interface', () => {
    const schema = z.strictObject({ a: z.string(), b: z.number().nullable() })
    expect(responseSchema<{ a: string, b: number | null }>()(schema)).toBe(schema)
  })

  // Each `@ts-expect-error` must keep failing: when the helper stops rejecting drift, the unused directive fails `npm run typecheck`
  it('rejects a schema that drifts from its interface (a type-level check)', () => {
    interface Pair { a: string, b: number | null }
    responseSchema<Pair>()(z.strictObject({ a: z.string(), b: z.number().nullable() }))
    // @ts-expect-error the schema lacks the nullable `b`
    responseSchema<Pair>()(z.strictObject({ a: z.string(), b: z.number() }))
    // @ts-expect-error the schema has a field the interface does not
    responseSchema<Pair>()(z.strictObject({ a: z.string(), b: z.number().nullable(), c: z.string() }))
    // @ts-expect-error the schema lacks a field of the interface
    responseSchema<Pair>()(z.strictObject({ a: z.string() }))
  })

  // `commentSchema` adds `children` by annotation, which checks it one way only (app/schemas/comments.ts); this pins the other way: the
  // interface's `children` must stay exactly an optional list of comments, as the schema's getter builds it
  it('keeps `Comment.children` an optional list of comments (a type-level check)', () => {
    type Same<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false
    const childrenStayOptionalComments: Same<Pick<Comment, 'children'>, { children?: Comment[] }> = true
    expect(childrenStayOptionalComments).toBe(true)
  })
})
