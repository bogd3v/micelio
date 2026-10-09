import { describe, it, expect } from 'vitest'
import { Category } from '~/interfaces/design'
import { categoryOrder, isCategory } from '~/helpers/categories'
import { CATEGORIES, CATEGORY_INFO } from '~/constants/categories'

describe('categories', () => {
  it('lists the five categories with the pillars first', () => {
    expect(CATEGORIES).toEqual([Category.Privacy, Category.Diy, Category.Ai, Category.Software, Category.Linux])
    expect(CATEGORY_INFO[Category.Privacy].pillar).toBe(1)
    expect(CATEGORY_INFO[Category.Diy].pillar).toBe(2)
    expect(CATEGORY_INFO[Category.Ai].pillar).toBeNull()
  })

  it('keeps the enum values equal to the Strapi slugs', () => {
    expect(Object.values(Category)).toEqual(['privacidad', 'diy', 'ia', 'software', 'linux'])
  })

  it('recognizes only known slugs', () => {
    expect(isCategory(Category.Diy)).toBe(true)
    expect(isCategory('DIY')).toBe(false)
    expect(isCategory('tutorial')).toBe(false)
    expect(isCategory(null)).toBe(false)
  })

  it('orders known categories first and unknown ones last', () => {
    expect(categoryOrder(Category.Privacy)).toBe(0)
    expect(categoryOrder(Category.Linux)).toBe(4)
    expect(categoryOrder('tutorial')).toBe(5)
    expect(categoryOrder(null)).toBe(5)
  })
})
