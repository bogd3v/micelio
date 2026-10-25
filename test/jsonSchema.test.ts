import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { satisfiesSchema } from '../app/helpers/jsonSchema'
import type { JsonSchema } from '../app/helpers/jsonSchema'
import previewSchema from '../app/preview/preview.schema.json'

const schema = previewSchema as JsonSchema

const ready = { v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-1', locale: 'en', version: '2026-10-24T09:30:00.000Z' } }
const loadDraft = { v: 1, type: 'load-draft', payload: { documentId: 'doc-1', locale: null } }

// Valid and invalid messages for the plugin's schema; `valid` is what the plugin's own zod schemas accept
const corpus: Array<[string, unknown, boolean]> = [
  ['ready', ready, true],
  ['ready with a null locale', { ...ready, payload: { ...ready.payload, locale: null } }, true],
  ['ready with several versions', { ...ready, payload: { ...ready.payload, v: [1, 2] } }, true],
  ['ready with an extra member', { ...ready, extra: true, payload: { ...ready.payload, extra: 1 } }, true],
  ['load-draft', loadDraft, true],
  ['load-draft with a locale', { ...loadDraft, payload: { documentId: 'doc-1', locale: 'es' } }, true],
  ['another v', { ...ready, v: 2 }, false],
  ['no v', { type: 'ready', payload: ready.payload }, false],
  ['an unknown type', { v: 1, type: 'block-hover', payload: null }, false],
  ['no payload', { v: 1, type: 'load-draft' }, false],
  ['an empty documentId', { ...loadDraft, payload: { documentId: '', locale: null } }, false],
  ['a missing locale', { ...loadDraft, payload: { documentId: 'doc-1' } }, false],
  ['a number for the locale', { ...loadDraft, payload: { documentId: 'doc-1', locale: 3 } }, false],
  ['an empty list of versions', { ...ready, payload: { ...ready.payload, v: [] } }, false],
  ['a zero version', { ...ready, payload: { ...ready.payload, v: [0] } }, false],
  ['a fractional version', { ...ready, payload: { ...ready.payload, v: [1.5] } }, false],
  ['a string version', { ...ready, payload: { ...ready.payload, v: ['1'] } }, false],
  ['an empty version', { ...ready, payload: { ...ready.payload, version: '' } }, false],
  ['a payload that is a list', { v: 1, type: 'load-draft', payload: [] }, false],
  ['a string', 'ready', false],
  ['null', null, false],
  ['a list', [ready], false],
]

describe('satisfiesSchema', () => {
  it.each(corpus)('reads %s as the plugin does', (_name, value, valid) => {
    expect(satisfiesSchema(schema, value)).toBe(valid)
  })

  it('agrees with zod\'s own reading of the same schema', () => {
    const reference = z.fromJSONSchema(schema as never)
    for (const [name, value] of corpus) expect(satisfiesSchema(schema, value), name).toBe(reference.safeParse(value).success)
  })

  it('refuses everything under a keyword it cannot check, so a newer schema is never accepted by mistake', () => {
    expect(satisfiesSchema({ type: 'string', pattern: '^a$' }, 'b')).toBe(false)
    expect(satisfiesSchema({ type: 'string', pattern: '^a$' }, 'a')).toBe(false)
    expect(satisfiesSchema({ type: 'object', additionalProperties: false }, {})).toBe(false)
  })

  it('refuses a $ref it cannot resolve and a type it does not know', () => {
    expect(satisfiesSchema({ $ref: '#/$defs/missing', $defs: {} }, {})).toBe(false)
    expect(satisfiesSchema({ $ref: 'https://example.com/schema.json' }, {})).toBe(false)
    expect(satisfiesSchema({ type: 'boolean' }, true)).toBe(false)
  })

  it('checks the bounds, the lengths and the items it reads', () => {
    expect(satisfiesSchema({ type: 'integer', exclusiveMinimum: 0, maximum: 3 }, 3)).toBe(true)
    expect(satisfiesSchema({ type: 'integer', exclusiveMinimum: 0, maximum: 3 }, 4)).toBe(false)
    expect(satisfiesSchema({ type: 'integer', exclusiveMinimum: 0, maximum: 3 }, 0)).toBe(false)
    expect(satisfiesSchema({ type: 'string', minLength: 2 }, 'a')).toBe(false)
    expect(satisfiesSchema({ type: 'array', minItems: 1, items: { type: 'number' } }, [1, Number.NaN])).toBe(false)
    expect(satisfiesSchema({ type: 'object', required: ['a'] }, { b: 1 })).toBe(false)
    expect(satisfiesSchema({ type: 'object', properties: { a: { const: 1 } } }, { a: 2 })).toBe(false)
    expect(satisfiesSchema({ anyOf: [{ type: 'null' }, { type: 'string' }] }, null)).toBe(true)
  })
})
