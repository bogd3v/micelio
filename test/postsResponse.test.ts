import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { categoryCountSchema, tagCountSchema } from '~/schemas/posts'

describe('posts response schemas', () => {
  it('accept what /api/categories and /api/tags send', () => {
    const categories = [{ id: 1, slug: 'devops', name: 'DevOps', count: 2 }, { id: 2, slug: null, name: 'Unnamed', count: 0 }]
    expect(z.array(categoryCountSchema).parse(categories)).toEqual(categories)
    const tags = [{ slug: 'devops', name: 'DevOps', count: 2 }, { slug: 'vue', name: 'Vue', count: 1 }]
    expect(z.array(tagCountSchema).parse(tags)).toEqual(tags)
  })

  it('reject a wrong shape', () => {
    expect(categoryCountSchema.safeParse({ id: 1, slug: 'devops', name: 'DevOps' }).success).toBe(false)
    expect(categoryCountSchema.safeParse({ id: '1', slug: 'devops', name: 'DevOps', count: 2 }).success).toBe(false)
    expect(tagCountSchema.safeParse({ slug: 'vue', name: 'Vue', count: 1, extra: 1 }).success).toBe(false)
    expect(categoryCountSchema.safeParse({ id: 1, slug: 'a', name: 'A', count: 1, extra: 1 }).success).toBe(false)
    expect(tagCountSchema.safeParse({ slug: null, name: 'Vue', count: 1 }).success).toBe(false)
    expect(tagCountSchema.safeParse({ slug: 'vue', name: 'Vue', count: 0 }).success).toBe(false)
  })
})
