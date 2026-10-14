import { describe, expect, it } from 'vitest'
import { allow, each, fields, variants } from '../app/helpers/allowList'

describe('allow', () => {
  it('keeps only the named fields, at every depth', () => {
    const shape = fields({ title: true, cover: fields({ url: true }) })
    expect(allow({ title: 'a', secret: 1, cover: { url: '/x', hash: 'h' } }, shape)).toEqual({ title: 'a', cover: { url: '/x' } })
  })

  it('keeps null, leaves out what is absent and drops a value of the wrong kind', () => {
    const shape = fields({ cover: fields({ url: true }), tags: each(true), note: true })
    expect(allow({ cover: null, tags: { a: 1 } }, shape)).toEqual({ cover: null })
  })

  it('keeps a value whole under true, so JSON-LD passes as it is', () => {
    expect(allow({ data: { a: [1, { b: 2 }] } }, fields({ data: true }))).toEqual({ data: { a: [1, { b: 2 }] } })
  })

  it('shapes each entry of a list and drops the ones that do not fit', () => {
    expect(allow([{ a: 1, b: 2 }, 'text', { a: 3 }], each(fields({ a: true })))).toEqual([{ a: 1 }, { a: 3 }])
  })

  it('follows the case a block names and drops an unknown one', () => {
    const shape = each(variants('__component', { 'a.one': fields({ __component: true, x: true }) }))
    const result = allow([{ __component: 'a.one', x: 1, y: 2 }, { __component: 'a.two', x: 1 }, { __component: '__proto__' }, { x: 1 }], shape)
    expect(result).toEqual([{ __component: 'a.one', x: 1 }])
  })

  it('does not read inherited keys', () => {
    expect(allow({}, fields({ toString: true }))).toEqual({})
  })
})
