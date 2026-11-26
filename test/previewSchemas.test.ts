import { describe, expect, it } from 'vitest'
import { contrastQuerySchema, previewDraftMetaSchema, previewGrantSchema, previewQuerySchema, weightParamsSchema, weightQuerySchema } from '../server/schemas/preview'

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
    // The accents are read since #737 (below): beside a theme they are kept, and an override of accents alone reads as one without a theme
    expect(previewGrantSchema.parse({ data: { ...grant, overrides: { theme, accentOverrides: [{ mode: 'light', color: '#1A2B3C' }] } } }).data.overrides).toEqual({ theme, accentOverrides: [{ mode: 'light', color: '#1A2B3C' }] })
    expect(previewGrantSchema.parse({ data: { ...grant, overrides: { accentOverrides: [] } } }).data.overrides).toEqual({ accentOverrides: [] })
    expect(previewGrantSchema.parse({ data: grant }).data).not.toHaveProperty('overrides')
  })

  it('refuses a theme override outside the grammar of a pin', () => {
    for (const theme of [{ id: 'starter' }, { version: '1.0.0' }, { id: 'Starter', version: '1.0.0' }, { id: '../x', version: '1.0.0' }, { id: 'starter', version: '1.0' }, { id: 'starter', version: '1.0.0+build' }, { id: 'starter', version: `1.0.0-${'a'.repeat(128)}` }, 'starter@1.0.0', null]) {
      expect(previewGrantSchema.safeParse({ data: { ...grant, overrides: { theme } } }).success, JSON.stringify(theme)).toBe(false)
    }
  })
})

describe('the accent overrides of a grant', () => {
  const accents = [{ mode: 'noche', color: '#5EEAD4' }, { mode: 'dia', color: '#0b5cad' }]

  it('reads the token overrides bound to the grant, and an answer without them', () => {
    // The exchange (`data.overrides`) and every draft read of an admin grant (`meta.overrides`) answer the same overrides
    expect(previewGrantSchema.parse({ data: { ...grant, overrides: { accentOverrides: accents } } }).data.overrides).toEqual({ accentOverrides: accents })
    expect(previewDraftMetaSchema.parse({ actor: 'admin', overrides: { accentOverrides: accents } })).toEqual({ actor: 'admin', overrides: { accentOverrides: accents } })
    expect(previewDraftMetaSchema.parse({ actor: 'admin', overrides: { theme: { id: 'starter', version: '0.1.0' }, accentOverrides: accents } }).overrides).toEqual({ theme: { id: 'starter', version: '0.1.0' }, accentOverrides: accents })
    // Without them, the answer reads as today's
    expect(previewGrantSchema.parse({ data: grant }).data).not.toHaveProperty('overrides')
    expect(previewDraftMetaSchema.parse({ actor: 'admin' })).toEqual({ actor: 'admin' })
    expect(previewDraftMetaSchema.parse({ actor: 'system' })).toEqual({ actor: 'system' })
    // Any other key, of the overrides or of an entry, is dropped: only the accent per mode is read
    expect(previewDraftMetaSchema.parse({ actor: 'admin', overrides: { ink: '#ff0000', roles: { ink: '#ff0000' }, accentOverrides: [{ mode: 'noche', color: '#5eead4', role: 'ink' }] } }).overrides).toEqual({ accentOverrides: [{ mode: 'noche', color: '#5eead4' }] })
    expect(previewDraftMetaSchema.parse({ actor: 'admin', overrides: { ink: '#ff0000' } }).overrides).toEqual({})
  })

  it('refuses accent overrides outside the grammar of the site\'s field', () => {
    const outside = [
      [{ mode: 'noche', color: 'red' }],
      [{ mode: 'noche', color: '#5eead' }],
      [{ mode: 'noche', color: '#5eead4ff' }],
      [{ mode: 'Noche', color: '#5eead4' }],
      [{ mode: 'noche"]{', color: '#5eead4' }],
      [{ mode: 'noche' }],
      [{ color: '#5eead4' }],
      [{ mode: 'noche', color: '#5eead4' }, { mode: 'noche', color: '#0b5cad' }],
      Array.from({ length: 17 }, (_, index) => ({ mode: `m${index}`, color: '#5eead4' })),
      { mode: 'noche', color: '#5eead4' },
      null,
    ]
    for (const accentOverrides of outside) {
      expect(previewGrantSchema.safeParse({ data: { ...grant, overrides: { accentOverrides } } }).success, JSON.stringify(accentOverrides)).toBe(false)
      expect(previewDraftMetaSchema.safeParse({ actor: 'admin', overrides: { accentOverrides } }).success, JSON.stringify(accentOverrides)).toBe(false)
    }
    expect(previewGrantSchema.safeParse({ data: { ...grant, overrides: { accentOverrides: Array.from({ length: 16 }, (_, index) => ({ mode: `m${index}`, color: '#5eead4' })) } } }).success).toBe(true)
  })
})

describe('contrastQuerySchema', () => {
  it('reads the document and each candidate as mode and color', () => {
    expect(contrastQuerySchema.parse({ documentId: 'doc-1' })).toEqual({ documentId: 'doc-1', accent: [] })
    expect(contrastQuerySchema.parse({ documentId: 'doc-1', accent: 'noche:#5eead4', other: 1 })).toEqual({ documentId: 'doc-1', accent: [{ mode: 'noche', color: '#5eead4' }] })
    expect(contrastQuerySchema.parse({ documentId: 'doc-1', accent: ['noche:#5eead4', 'dia:#0B5CAD'] }).accent).toEqual([{ mode: 'noche', color: '#5eead4' }, { mode: 'dia', color: '#0B5CAD' }])
  })

  it('refuses a missing document and a candidate outside the grammar', () => {
    for (const query of [{}, { documentId: '../x' }, { documentId: ['a', 'b'] }]) expect(contrastQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(false)
    for (const accent of ['noche', 'noche:', 'noche:red', ':#5eead4', 'noche:#5eead4:x', ['noche:#5eead4', 'noche:#0b5cad']]) {
      expect(contrastQuerySchema.safeParse({ documentId: 'doc-1', accent }).success, JSON.stringify(accent)).toBe(false)
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

  it('weightQuerySchema reads measure=reference and refuses any other measure', () => {
    expect(weightQuerySchema.parse({ locale: 'en', mode: 'dynamic', measure: 'reference' })).toEqual({ locale: 'en', mode: 'dynamic', measure: 'reference' })
    expect(weightQuerySchema.parse({ mode: 'dynamic' })).not.toHaveProperty('measure')
    for (const measure of ['', 'Reference', 'draft', 'page', ['reference'], ['reference', 'reference'], 1, true, null]) {
      const parsed = weightQuerySchema.safeParse({ mode: 'dynamic', measure })
      expect(parsed.success, JSON.stringify(measure)).toBe(false)
      // The route tells the marker's refusal (the draft 404) from a locale's (400) by the path of the issue
      expect(parsed.error?.issues.map(issue => issue.path[0]), JSON.stringify(measure)).toEqual(['measure'])
    }
  })
})
