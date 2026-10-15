import { describe, expect, it } from 'vitest'
import { fediverseStatsByIdSchema, fediverseStatsSchema } from '~/schemas/fediverse'

describe('fediverse response schemas', () => {
  it('accept what the routes send', () => {
    expect(fediverseStatsSchema.parse({ likes: 4, boosts: 2 })).toEqual({ likes: 4, boosts: 2 })
    expect(fediverseStatsByIdSchema.parse({ 'doc-vue-es': { likes: 4, boosts: 2 }, 'doc-linux': { likes: 0, boosts: 1 } })).toHaveProperty('doc-linux')
    expect(fediverseStatsByIdSchema.parse({})).toEqual({})
  })

  it('reject a wrong shape', () => {
    expect(fediverseStatsSchema.safeParse({ likes: 4 }).success).toBe(false)
    expect(fediverseStatsSchema.safeParse({ likes: 4, boosts: 2, extra: 1 }).success).toBe(false)
    expect(fediverseStatsSchema.safeParse({ likes: -1, boosts: 0 }).success).toBe(false)
    expect(fediverseStatsSchema.safeParse({ likes: 1.5, boosts: 0 }).success).toBe(false)
    expect(fediverseStatsByIdSchema.safeParse({ 'doc-linux': { likes: '0', boosts: 1 } }).success).toBe(false)
  })
})
