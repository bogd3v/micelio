import { describe, expect, it } from 'vitest'
import { mockIssues, shapeOf } from '../scripts/contract/shape.mjs'

const issues = (mock: unknown, real: unknown) => mockIssues(shapeOf(mock), shapeOf(real))

describe('mockIssues', () => {
  it('finds nothing when the mock has the keys and types of the CMS', () => {
    expect(issues({ data: [{ id: 1, slug: 'a', tags: [] }], meta: {} }, { data: [{ id: 7, slug: 'b', tags: [{ slug: 'x' }], extra: true }], meta: { pagination: {} } })).toEqual([])
  })

  it('names the key the mock has and the CMS does not, as a renamed field shows up', () => {
    expect(issues({ data: [{ id: 1, titulo: 'a' }] }, { data: [{ id: 1, title: 'a' }] })).toEqual(['$.data[].titulo: in the mock, not in the CMS'])
  })

  it('names a type the CMS does not use', () => {
    expect(issues({ count: '3' }, { count: 3 })).toEqual(['$.count: the mock has string, the CMS has number'])
    expect(issues({ data: {} }, { data: [] })).toEqual(['$.data: the mock has object, the CMS has array'])
  })

  it('does not report what the CMS answers and the mock leaves out', () => {
    expect(issues({ id: 1 }, { id: 1, createdAt: 'x', seo: { title: 'y' } })).toEqual([])
  })

  it('takes a null on either side as saying nothing about the type', () => {
    expect(issues({ seo: null }, { seo: { title: 'y' } })).toEqual([])
    expect(issues({ seo: { title: 'y' } }, { seo: null })).toEqual([])
  })

  it('compares the items of two arrays, merged, and skips an empty one', () => {
    expect(issues({ tags: [{ slug: 'a', name: 'A' }] }, { tags: [{ slug: 'a' }, { slug: 'b', name: 'B' }] })).toEqual([])
    expect(issues({ tags: [{ slug: 'a', color: 'red' }] }, { tags: [{ slug: 'a' }] })).toEqual(['$.tags[].color: in the mock, not in the CMS'])
    expect(issues({ tags: [{ slug: 'a', color: 'red' }] }, { tags: [] })).toEqual([])
  })

  it('compares the blocks of a dynamic zone by component, and only those the CMS answered', () => {
    const real = { blocks: [{ __component: 'shared.rich-text', body: 'x' }] }
    expect(issues({ blocks: [{ __component: 'shared.rich-text', body: 'y' }, { __component: 'about.profile', title: 'T' }] }, real)).toEqual([])
    expect(issues({ blocks: [{ __component: 'shared.rich-text', text: 'y' }] }, real)).toEqual(['$.blocks[shared.rich-text].text: in the mock, not in the CMS'])
  })
})
