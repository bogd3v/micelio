import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '../app/helpers/rateLimit'

const rule = { limit: 2, windowMs: 60_000 }

describe('createRateLimiter', () => {
  it('allows up to the limit inside the window and reports when to retry', () => {
    const limiter = createRateLimiter()
    expect(limiter.consume('ip', rule, 0).allowed).toBe(true)
    expect(limiter.consume('ip', rule, 1_000).allowed).toBe(true)
    expect(limiter.consume('ip', rule, 30_000)).toEqual({ allowed: false, retryAfterSeconds: 30 })
  })

  it('counts each key on its own', () => {
    const limiter = createRateLimiter()
    limiter.consume('a', rule, 0)
    limiter.consume('a', rule, 0)
    expect(limiter.consume('a', rule, 0).allowed).toBe(false)
    expect(limiter.consume('b', rule, 0).allowed).toBe(true)
  })

  it('starts a new window once the previous one ends', () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < 3; i++) limiter.consume('ip', rule, 0)
    expect(limiter.consume('ip', rule, 60_000).allowed).toBe(true)
  })
})

describe('createRateLimiter, memory and cost', () => {
  const rule = { limit: 5, windowMs: 60_000 }

  it('never tracks more than 10,000 keys, whatever number of live ones arrive', () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < 25_000; i++) limiter.consume(`ip:${i}`, rule, 1_000)
    expect(limiter.size()).toBeLessThanOrEqual(10_000)
  })

  it('drops the oldest windows first, so a key just seen is still counted', () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < 12_000; i++) limiter.consume(`ip:${i}`, rule, 1_000)
    for (let n = 0; n < 5; n++) limiter.consume('ip:11999', rule, 1_001)
    expect(limiter.consume('ip:11999', rule, 1_002).allowed).toBe(false)
  })

  it('does not scan the whole map for every new key once it is full', () => {
    const limiter = createRateLimiter()
    const started = performance.now()
    for (let i = 0; i < 200_000; i++) limiter.consume(`ip:${i}`, rule, 1_000)
    // About 97 seconds with a full scan per key; a second is a generous bound for the amortised version
    expect(performance.now() - started).toBeLessThan(2_000)
  })

  it('still frees expired windows before it evicts live ones', () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < 10_000; i++) limiter.consume(`ip:${i}`, rule, 1_000)
    limiter.consume('ip:new', rule, 1_000 + 61_000)
    expect(limiter.size()).toBe(1)
  })
})
