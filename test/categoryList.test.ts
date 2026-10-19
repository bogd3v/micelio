import { describe, expect, it } from 'vitest'
import { mergeLocalized, shapeCategories, sortCategories } from '../server/lib/categoryList'

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
      { id: 1, slug: 'garden', name: 'Garden', description: 'Plants', order: 1, featured: false, color: null, count: 2 },
      { id: 2, slug: 'kitchen', name: 'Kitchen', description: null, order: 2, featured: false, color: null, count: 0 },
      { id: 3, slug: 'loose', name: 'Loose', description: null, order: null, featured: false, color: null, count: 0 },
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

  it('reads featured as a boolean', () => {
    const shaped = shapeCategories([
      { id: 1, name: 'A', slug: 'a' },
      { id: 2, name: 'B', slug: 'b', featured: false },
      { id: 3, name: 'C', slug: 'c', featured: true },
    ])
    expect(shaped.map(category => category.featured)).toEqual([false, false, true])
  })

  it('keeps a color from 1 to 5 and drops anything else to null', () => {
    const colors = [1, 5, 0, 6, 2.5, null, undefined, '3' as unknown as number]
    const shaped = shapeCategories(colors.map((color, index) => ({ id: index, name: `C${index}`, slug: `c${index}`, color, order: index })))
    expect(shaped.map(category => category.color)).toEqual([1, 5, null, null, null, null, null, null])
  })
})

describe('mergeLocalized', () => {
  const base = shapeCategories([
    { id: 1, name: 'Garden', slug: 'garden', description: 'Plants', order: 1, articles: [{ id: 1 }] },
    { id: 2, name: 'Kitchen', slug: 'kitchen', order: 2, articles: [{ id: 2 }] },
  ])

  it('takes name and count from the locale and keeps the order of the default one', () => {
    const localized = shapeCategories([{ id: 1, name: 'Jardin', slug: 'garden', order: 1, articles: [{ id: 5 }, { id: 6 }] }])
    const merged = mergeLocalized(base, localized)
    expect(merged.map(category => [category.slug, category.name, category.count])).toEqual([['garden', 'Jardin', 2], ['kitchen', 'kitchen', 0]])
    expect(merged[0]?.description).toBe('Plants')
  })

  it('adds a category only the locale has', () => {
    const localized = shapeCategories([{ id: 9, name: 'Solo', slug: 'solo', order: 3 }])
    expect(mergeLocalized(base, localized).map(category => category.slug)).toEqual(['garden', 'kitchen', 'solo'])
  })
})
