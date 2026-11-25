import { describe, expect, it } from 'vitest'
import { previewGrantSchema, previewQuerySchema, weightParamsSchema, weightQuerySchema } from '../server/schemas/preview'

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

describe('the theme override of a grant', () => {
  it('reads a theme override bound to the grant, and an answer without one', () => {
    const theme = { id: 'starter', version: '0.1.0' }
    expect(previewGrantSchema.parse({ data: { ...grant, overrides: { theme } } }).data.overrides).toEqual({ theme })
    // The accents are #737's: they are dropped, and an override of accents alone reads as one without a theme
    expect(previewGrantSchema.parse({ data: { ...grant, overrides: { theme, accentOverrides: [{ mode: 'light', color: '#1A2B3C' }] } } }).data.overrides).toEqual({ theme })
    expect(previewGrantSchema.parse({ data: { ...grant, overrides: { accentOverrides: [] } } }).data.overrides).toEqual({})
    expect(previewGrantSchema.parse({ data: grant }).data).not.toHaveProperty('overrides')
  })

  it('refuses a theme override outside the grammar of a pin', () => {
    for (const theme of [{ id: 'starter' }, { version: '1.0.0' }, { id: 'Starter', version: '1.0.0' }, { id: '../x', version: '1.0.0' }, { id: 'starter', version: '1.0' }, { id: 'starter', version: '1.0.0+build' }, { id: 'starter', version: `1.0.0-${'a'.repeat(128)}` }, 'starter@1.0.0', null]) {
      expect(previewGrantSchema.safeParse({ data: { ...grant, overrides: { theme } } }).success, JSON.stringify(theme)).toBe(false)
    }
  })
})

describe('weightParamsSchema', () => {
  it('accepts the two content types of the preview and a document id', () => {
    expect(weightParamsSchema.parse({ uid: 'api::article.article', documentId: 'kd8f3j2l1m0p' })).toEqual({ uid: 'api::article.article', documentId: 'kd8f3j2l1m0p' })
    expect(weightParamsSchema.safeParse({ uid: 'api::page.page', documentId: 'doc-page_1' }).success).toBe(true)
  })

  it('refuses another content type, a key of Object.prototype and a document id outside the alphabet', () => {
    for (const uid of ['api::tag.tag', 'toString', '', 'api::page.page ']) expect(weightParamsSchema.safeParse({ uid, documentId: 'doc-1' }).success).toBe(false)
    for (const documentId of ['', 'a/b', 'a b', '../x', 'a'.repeat(65)]) expect(weightParamsSchema.safeParse({ uid: 'api::page.page', documentId }).success).toBe(false)
  })
})

describe('weightQuerySchema', () => {
  it('defaults to no locale and the dynamic mode', () => {
    expect(weightQuerySchema.parse({})).toEqual({ mode: 'dynamic' })
    expect(weightQuerySchema.parse({ locale: '', mode: 'static' })).toEqual({ mode: 'static' })
  })

  it('takes a supported locale, reads any mode but static as dynamic and refuses an unsupported locale', () => {
    expect(weightQuerySchema.parse({ locale: 'es', mode: 'other' })).toEqual({ locale: 'es', mode: 'dynamic' })
    expect(weightQuerySchema.safeParse({ locale: 'fr' }).success).toBe(false)
    expect(weightQuerySchema.safeParse({ locale: ['en', 'es'] }).success).toBe(false)
  })
})
