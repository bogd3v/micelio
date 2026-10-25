import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isIslandScript, parseLoadDraft, previewDraftPath, previewMode, readyMessage, secondsUntil, withoutIndex } from '../app/helpers/preview'
import { satisfiesSchema } from '../app/helpers/jsonSchema'
import type { JsonSchema } from '../app/helpers/jsonSchema'
import previewSchema from '../app/preview/preview.schema.json'

describe('the copy of the plugin\'s message schema', () => {
  // app/preview/preview.schema.json is contract/preview.schema.json of micelio-plugin-core at e8aeb07, copied because the package is not published yet
  it('is the file that was copied, byte for byte', () => {
    const bytes = readFileSync(new URL('../app/preview/preview.schema.json', import.meta.url))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('f22eb1c290f750179ba1e90ec8d28b30c8b0d0af93a0a29a316be161c8d30f48')
  })
})

describe('previewMode', () => {
  it('is dynamic unless the mode asked for is static', () => {
    expect(previewMode('static')).toBe('static')
    for (const value of ['dynamic', 'Static', '', undefined, null, ['static'], 1]) expect(previewMode(value)).toBe('dynamic')
  })
})

describe('withoutIndex', () => {
  it('reads a plain number of up to three digits', () => {
    expect(withoutIndex('0')).toBe(0)
    expect(withoutIndex('7')).toBe(7)
    expect(withoutIndex('999')).toBe(999)
  })

  it('is undefined for anything else, so a request cannot ask for a block it did not number', () => {
    for (const value of ['', '-1', '1.5', '1e2', '1000', ' 1', '0x1', 'a', undefined, null, 3, ['1'], { 0: '1' }]) expect(withoutIndex(value)).toBeUndefined()
  })
})

describe('isIslandScript', () => {
  it('holds for the declaration of a heavy island and the script of a light one', () => {
    expect(isIslandScript({ tag: 'script', props: { id: 'micelio-island-scene', type: 'application/json' } })).toBe(true)
    expect(isIslandScript({ tag: 'script', key: 'island-loader', props: { src: '/_islands/loader-abc.js', type: 'module' } })).toBe(true)
    expect(isIslandScript({ tag: 'script', props: { src: '/_islands/search-abc.js' } })).toBe(true)
  })

  it('does not hold for the theme script, a Nuxt script, a style or a link', () => {
    expect(isIslandScript({ tag: 'script', props: { id: 'theme-init' } })).toBe(false)
    expect(isIslandScript({ tag: 'script', props: { src: '/_nuxt/entry.js' } })).toBe(false)
    expect(isIslandScript({ tag: 'script', key: 'speculation-rules' })).toBe(false)
    expect(isIslandScript({ tag: 'link', props: { href: '/_islands/x.css', id: 'micelio-island-x' } })).toBe(false)
    expect(isIslandScript({})).toBe(false)
  })
})

describe('previewDraftPath without a block', () => {
  it('names the block to leave out, after the mode', () => {
    expect(previewDraftPath('page', 'doc-1', 'en', 'static', 2)).toBe('/drafts/pages/doc-1?locale=en&mode=static&without=2')
    expect(previewDraftPath('article', 'doc-1', 'es', 'dynamic', 0)).toBe('/es/drafts/doc-1?locale=es&without=0')
  })
})

describe('previewDraftPath', () => {
  it('opens the article draft route, and the page draft route for a page', () => {
    expect(previewDraftPath('article', 'doc-1', 'en')).toBe('/drafts/doc-1?locale=en')
    expect(previewDraftPath('page', 'doc-1', 'en')).toBe('/drafts/pages/doc-1?locale=en')
  })

  it('puts the language prefix on the Spanish routes', () => {
    expect(previewDraftPath('article', 'doc-1', 'es')).toBe('/es/drafts/doc-1?locale=es')
    expect(previewDraftPath('page', 'doc-1', 'es')).toBe('/es/drafts/pages/doc-1?locale=es')
  })

  it('opens the default language for a locale the site does not serve or none', () => {
    expect(previewDraftPath('article', 'doc-1', 'fr')).toBe('/drafts/doc-1?locale=en')
    expect(previewDraftPath('article', 'doc-1', null)).toBe('/drafts/doc-1?locale=en')
  })

  it('keeps the static mode and encodes the document id, and never carries a token', () => {
    expect(previewDraftPath('article', 'doc-1', 'en', 'static')).toBe('/drafts/doc-1?locale=en&mode=static')
    expect(previewDraftPath('article', 'doc-1', 'en', 'dynamic')).toBe('/drafts/doc-1?locale=en')
    expect(previewDraftPath('article', 'a/b?c', 'en')).toBe('/drafts/a%2Fb%3Fc?locale=en')
  })
})

describe('secondsUntil', () => {
  it('rounds up, and is 0 for a date that has passed or is not a date', () => {
    const now = Date.parse('2026-10-25T10:00:00.000Z')
    expect(secondsUntil('2026-10-25T10:15:00.000Z', now)).toBe(900)
    expect(secondsUntil('2026-10-25T10:00:00.500Z', now)).toBe(1)
    expect(secondsUntil('2026-10-25T09:00:00.000Z', now)).toBe(0)
    expect(secondsUntil('soon', now)).toBe(0)
  })
})

describe('the messages of the frame', () => {
  const schema = previewSchema as JsonSchema

  it('says ready in the envelope the plugin\'s schema describes, with the versions it speaks', () => {
    const message = readyMessage({ adminOrigin: 'https://cms.example.com', documentId: 'doc-1', locale: 'es', version: '2026-10-24T09:30:00.000Z' })
    expect(message).toEqual({ v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-1', locale: 'es', version: '2026-10-24T09:30:00.000Z' } })
    expect(satisfiesSchema(schema, message)).toBe(true)
    expect(satisfiesSchema(schema, readyMessage({ adminOrigin: 'https://cms.example.com', documentId: 'doc-1', locale: null, version: 'v' }))).toBe(true)
  })

  it('reads a load-draft and nothing else', () => {
    const loadDraft = { v: 1, type: 'load-draft', payload: { documentId: 'doc-1', locale: 'en' } }
    expect(parseLoadDraft(loadDraft)).toEqual(loadDraft)
    // Valid for the schema, but it travels the other way: the frame drops it
    expect(parseLoadDraft({ v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-1', locale: 'en', version: 'x' } })).toBeUndefined()
  })

  it('drops what fails the schema and ignores an unknown type', () => {
    for (const data of [null, 'load-draft', { v: 2, type: 'load-draft', payload: { documentId: 'doc-1', locale: null } }, { v: 1, type: 'load-draft', payload: { documentId: '', locale: null } }, { v: 1, type: 'load-draft', payload: {} }, { v: 1, type: 'block-select', payload: { zone: 'sections' } }]) {
      expect(parseLoadDraft(data)).toBeUndefined()
    }
  })
})
