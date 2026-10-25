import { describe, expect, it } from 'vitest'
import { previewGrantSchema, previewQuerySchema } from '../server/schemas/preview'

const grant = { grant: 'g', expiresAt: '2026-10-25T10:15:00.000Z', adminOrigin: 'https://cms.example.com', contentType: 'api::article.article', documentId: 'doc-1', locale: 'en' }

describe('previewQuerySchema', () => {
  it('reads the token, and the mode when there is one', () => {
    expect(previewQuerySchema.parse({ token: 'abc' })).toEqual({ token: 'abc' })
    expect(previewQuerySchema.parse({ token: 'abc', mode: 'static', other: 1 })).toEqual({ token: 'abc', mode: 'static' })
  })

  it('refuses a missing, empty, repeated or oversized token', () => {
    for (const query of [{}, { token: '' }, { token: ['a', 'b'] }, { token: 1 }, { token: 'a'.repeat(257) }]) expect(previewQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(false)
    expect(previewQuerySchema.safeParse({ token: 'a'.repeat(256) }).success).toBe(true)
  })
})

describe('previewGrantSchema', () => {
  it('reads what the CMS answers to the exchange, with or without a locale', () => {
    expect(previewGrantSchema.parse({ data: grant }).data).toEqual(grant)
    expect(previewGrantSchema.parse({ data: { ...grant, locale: null } }).data.locale).toBeNull()
  })

  it('refuses an answer that lacks a member or has the wrong shape', () => {
    for (const key of Object.keys(grant)) {
      const { [key]: _removed, ...rest } = grant as Record<string, unknown>
      expect(previewGrantSchema.safeParse({ data: rest }).success, key).toBe(false)
    }
    for (const body of [null, {}, { data: null }, { data: { ...grant, grant: '' } }, { data: { ...grant, locale: 3 } }, grant]) expect(previewGrantSchema.safeParse(body).success).toBe(false)
  })
})
