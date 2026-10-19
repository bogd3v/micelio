import { describe, expect, it } from 'vitest'
import type { CategoryEntry } from '~/interfaces'
import { categoryColor } from '~/helpers/categories'
import { categoryNameIn, fieldGuideTopics } from '~/helpers/categoryList'

function category(slug: string, count: number, featured = false, order: number | null = null, name = slug.toUpperCase(), color: number | null = null): CategoryEntry {
  return { id: 1, slug, name, description: null, order, featured, color, count }
}

const SEVEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(slug => category(slug, 1))

describe('categoryColor', () => {
  it('gives each category the role of its position and wraps after the fifth', () => {
    expect(SEVEN.map(({ slug }) => categoryColor(SEVEN, slug))).toEqual([
      'var(--category-1)', 'var(--category-2)', 'var(--category-3)', 'var(--category-4)', 'var(--category-5)', 'var(--category-1)', 'var(--category-2)',
    ])
  })

  it('counts empty categories in the position, so hiding one moves no color', () => {
    const list = [category('a', 0), category('b', 2)]
    expect(categoryColor(list, 'b')).toBe('var(--category-2)')
  })

  it('is neutral for an unknown or missing slug', () => {
    expect(categoryColor(SEVEN, 'zzz')).toBe('var(--ink-muted)')
    expect(categoryColor(SEVEN, null)).toBe('var(--ink-muted)')
    expect(categoryColor([], 'a')).toBe('var(--ink-muted)')
  })
})

describe('color ranking', () => {
  it('ranks by order, those without one last, then by slug, whatever the list order', () => {
    const list = [category('z', 1, false, 1), category('m', 1), category('b', 1, false, 2), category('a', 1), category('y', 1, false, 1)]
    expect(['y', 'z', 'b', 'a', 'm'].map(slug => categoryColor(list, slug))).toEqual([
      'var(--category-1)', 'var(--category-2)', 'var(--category-3)', 'var(--category-4)', 'var(--category-5)',
    ])
  })

  it('gives a category the same color in both languages when the names sort differently', () => {
    // No `order`: the display order follows the localized name (garden, kitchen in English; cocina, jardin in Spanish)
    const english = [category('garden', 1, false, null, 'Garden'), category('kitchen', 1, false, null, 'Kitchen')]
    const spanish = [category('kitchen', 1, false, null, 'Cocina'), category('garden', 1, false, null, 'Jardín')]
    for (const slug of ['garden', 'kitchen']) expect(categoryColor(spanish, slug)).toBe(categoryColor(english, slug))
    expect(categoryColor(english, 'garden')).toBe('var(--category-1)')
  })
})

describe('pinned color', () => {
  const list = (): CategoryEntry[] => [category('a', 1, false, 1), category('b', 1, false, 2, 'B', 5), category('c', 1, false, 3)]

  it('wins over the rank, and the others keep theirs', () => {
    expect(['a', 'b', 'c'].map(slug => categoryColor(list(), slug))).toEqual(['var(--category-1)', 'var(--category-5)', 'var(--category-3)'])
  })

  it('ignores a color that is not an integer from 1 to 5', () => {
    for (const bad of [0, 6, 2.5, -1, Number.NaN]) {
      expect(categoryColor([category('a', 1, false, 1, 'A', bad)], 'a')).toBe('var(--category-1)')
    }
  })

  it('does not move when the others are reordered, added or removed', () => {
    const others = [category('x', 1, false, 0), category('y', 1, false, 9)]
    expect(categoryColor([...list(), ...others], 'b')).toBe('var(--category-5)')
    expect(categoryColor([...list().reverse(), ...others], 'b')).toBe('var(--category-5)')
    expect(categoryColor([list()[1]!], 'b')).toBe('var(--category-5)')
  })

  it('does not change the rank color of the others when a pin is added', () => {
    const plain = [category('a', 1, false, 1), category('b', 1, false, 2), category('c', 1, false, 3)]
    expect(categoryColor(plain, 'c')).toBe(categoryColor(list(), 'c'))
  })

  it('is the same in both languages', () => {
    const english = [category('garden', 1, false, null, 'Garden', 4), category('kitchen', 1, false, null, 'Kitchen')]
    const spanish = [category('kitchen', 1, false, null, 'Cocina'), category('garden', 1, false, null, 'Jardín', 4)]
    for (const slug of ['garden', 'kitchen']) expect(categoryColor(spanish, slug)).toBe(categoryColor(english, slug))
    expect(categoryColor(english, 'garden')).toBe('var(--category-4)')
  })
})

describe('categoryNameIn', () => {
  it('gives the name of the list, else the slug, else nothing', () => {
    expect(categoryNameIn(SEVEN, 'c')).toBe('C')
    expect(categoryNameIn(SEVEN, 'zzz')).toBe('zzz')
    expect(categoryNameIn(SEVEN, undefined)).toBe('')
  })
})

describe('fieldGuideTopics', () => {
  it('puts the featured categories first, drops the empty ones and keeps the CMS order in each group', () => {
    const list = [category('a', 1), category('b', 0, true), category('c', 3, true), category('d', 2), category('e', 4, true)]
    expect(fieldGuideTopics(list, 6)).toEqual([
      { category: 'c', count: 3 }, { category: 'e', count: 4 }, { category: 'a', count: 1 }, { category: 'd', count: 2 },
    ])
  })

  it('shows at most the limit and nothing for an empty or all-empty list', () => {
    expect(fieldGuideTopics(SEVEN, 6)).toHaveLength(6)
    expect(fieldGuideTopics([], 6)).toEqual([])
    expect(fieldGuideTopics([category('a', 0, true)], 6)).toEqual([])
  })
})
