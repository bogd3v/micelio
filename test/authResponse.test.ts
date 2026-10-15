import { describe, expect, it } from 'vitest'
import { toPublicUser } from '~/helpers/auth'
import { authUserResponseSchema, okResponseSchema } from '~/schemas/auth'
import { responseSchema } from '~/schemas/response'
import { z } from 'zod'

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
  // The negative type cases are in app/schemas/response.typecheck.ts, which `npm run typecheck` covers
  it('returns the schema unchanged when it matches the interface', () => {
    const schema = z.strictObject({ a: z.string(), b: z.number().nullable() })
    expect(responseSchema<{ a: string, b: number | null }>()(schema)).toBe(schema)
  })
})
