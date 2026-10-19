import { describe, expect, it } from 'vitest'
import type { CategoryEntry } from '~/interfaces'
import { categoryColorIn, categoryNameIn, fieldGuideTopics } from '~/helpers/categoryList'

function category(slug: string, count: number, featured = false): CategoryEntry {
  return { id: 1, slug, name: slug.toUpperCase(), description: null, order: null, featured, count }
}

const SEVEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(slug => category(slug, 1))

describe('categoryColorIn', () => {
  it('gives each category the role of its position and wraps after the fifth', () => {
    expect(SEVEN.map(({ slug }) => categoryColorIn(SEVEN, slug))).toEqual([
      'var(--category-1)', 'var(--category-2)', 'var(--category-3)', 'var(--category-4)', 'var(--category-5)', 'var(--category-1)', 'var(--category-2)',
    ])
  })

  it('counts empty categories in the position, so hiding one moves no color', () => {
    const list = [category('a', 0), category('b', 2)]
    expect(categoryColorIn(list, 'b')).toBe('var(--category-2)')
  })

  it('is neutral for an unknown or missing slug', () => {
    expect(categoryColorIn(SEVEN, 'zzz')).toBe('var(--ink-muted)')
    expect(categoryColorIn(SEVEN, null)).toBe('var(--ink-muted)')
    expect(categoryColorIn([], 'a')).toBe('var(--ink-muted)')
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
