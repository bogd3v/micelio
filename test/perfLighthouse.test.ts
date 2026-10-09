import { describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM script without types
import { collectSamples, medianSample, readSample } from '../scripts/perf/lighthouse-samples.mjs'

function lhr(overrides: { lcp?: number | null, performance?: number | null } = {}) {
  const lcp = 'lcp' in overrides ? overrides.lcp : 1730.4
  const performance = 'performance' in overrides ? overrides.performance : 0.995
  return {
    audits: {
      'largest-contentful-paint': { numericValue: lcp ?? undefined },
      'total-blocking-time': { numericValue: 0 },
      'cumulative-layout-shift': { numericValue: 0.0004 },
    },
    categories: { performance: { score: performance }, accessibility: { score: 1 } },
  }
}

describe('readSample', () => {
  it('reads a complete result', () => {
    expect(readSample(lhr())).toEqual({ lcpMs: 1730, tbtMs: 0, cls: 0, performance: 100, accessibility: 100 })
  })

  it('is null without a performance score', () => {
    expect(readSample(lhr({ performance: null }))).toBeNull()
  })

  it('is null when a metric audit has no value', () => {
    expect(readSample(lhr({ lcp: null }))).toBeNull()
  })

  it('is null when a category is missing', () => {
    const result = lhr()
    expect(readSample({ ...result, categories: { accessibility: result.categories.accessibility } })).toBeNull()
  })
})

describe('medianSample', () => {
  it('takes the median of each metric', () => {
    const sample = (lcpMs: number) => ({ lcpMs, tbtMs: 0, cls: 0, performance: 100, accessibility: 100 })
    expect(medianSample([sample(1900), sample(1700), sample(1800)]).lcpMs).toBe(1800)
  })
})

describe('collectSamples', () => {
  function sequence(results: object[]) {
    let calls = 0
    return { measureOnce: async () => results[calls++], calls: () => calls }
  }

  it('retries an empty result and still gets the wanted samples', async () => {
    const run = sequence([lhr(), lhr({ performance: null }), lhr(), lhr()])
    const metrics = await collectSamples(run.measureOnce, 3)
    expect(metrics.performance).toBe(100)
    expect(run.calls()).toBe(4)
  })

  it('is null, not performance 0, when every attempt is empty', async () => {
    const run = sequence(Array.from({ length: 6 }, () => lhr({ performance: null })))
    expect(await collectSamples(run.measureOnce, 3)).toBeNull()
    expect(run.calls()).toBe(6)
  })

  it('does not retry when the first runs are complete', async () => {
    const run = sequence([lhr(), lhr(), lhr()])
    await collectSamples(run.measureOnce, 3)
    expect(run.calls()).toBe(3)
  })
})
