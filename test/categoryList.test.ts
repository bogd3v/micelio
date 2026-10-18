import { describe, expect, it } from 'vitest'
import { shapeCategories, sortCategories } from '../server/lib/categoryList'

describe('sortCategories', () => {
  it('sorts by order ascending, then those without one, then by name', () => {
    const sorted = sortCategories([
      { order: null, name: 'Zeta' },
      { order: 2, name: 'B' },
      { order: null, name: 'Alpha' },
      { order: 1, name: 'Z' },
      { order: 2, name: 'A' },
    ])
    expect(sorted.map(category => category.name)).toEqual(['Z', 'A', 'B', 'Alpha', 'Zeta'])
  })

  it('does not change its input', () => {
    const input = [{ order: 2, name: 'b' }, { order: 1, name: 'a' }]
    sortCategories(input)
    expect(input.map(category => category.name)).toEqual(['b', 'a'])
  })
})

describe('shapeCategories', () => {
  it('shapes, counts and sorts the CMS answer', () => {
    const shaped = shapeCategories([
      { id: 2, name: 'Kitchen', slug: 'kitchen', order: 2, articles: [] },
      { id: 1, name: 'Garden', slug: 'garden', description: ' Plants ', order: 1, articles: [{ id: 9 }, { id: 10 }] },
      { id: 3, name: 'Loose', slug: 'loose' },
    ])
    expect(shaped).toEqual([
      { id: 1, slug: 'garden', name: 'Garden', description: 'Plants', order: 1, featured: false, count: 2 },
      { id: 2, slug: 'kitchen', name: 'Kitchen', description: null, order: 2, featured: false, count: 0 },
      { id: 3, slug: 'loose', name: 'Loose', description: null, order: null, featured: false, count: 0 },
    ])
  })

  it('drops categories without a usable slug and falls back to the slug for the name', () => {
    const shaped = shapeCategories([
      { id: 1, name: 'No slug', slug: null },
      { id: 2, name: 'Spaces', slug: 'a b' },
      { id: 3, name: 'Upper', slug: 'Upper' },
      { id: 4, name: '  ', slug: 'plain' },
    ])
    expect(shaped.map(category => [category.slug, category.name])).toEqual([['plain', 'plain']])
  })

  it('reads featured, falling back to pillar', () => {
    const shaped = shapeCategories([
      { id: 1, name: 'A', slug: 'a', pillar: true },
      { id: 2, name: 'B', slug: 'b', featured: false, pillar: true },
      { id: 3, name: 'C', slug: 'c', featured: true },
    ])
    expect(shaped.map(category => category.featured)).toEqual([true, false, true])
  })
})
