import { describe, expect, it } from 'vitest'
import { swdGramsPerLoad, swdGramsPerView, swdMilligramsPerView } from '../scripts/perf/carbon.mjs'

// Hand-computed anchors: 0.300 kWh/GB x 494 g/kWh = 148.2 g per GB; a view weighs 0.75 + 0.25 x 0.02 = 0.755 of a cold load
describe('swdGramsPerLoad', () => {
  it('is 0 for no bytes, a negative or a non-finite count', () => {
    expect(swdGramsPerLoad(0)).toBe(0)
    expect(swdGramsPerLoad(-5)).toBe(0)
    expect(swdGramsPerLoad(Number.NaN)).toBe(0)
    expect(swdGramsPerLoad(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('is 148.2 g for one gigabyte', () => {
    expect(swdGramsPerLoad(1e9)).toBeCloseTo(148.2, 9)
  })

  it('scales linearly, also for a very large page', () => {
    expect(swdGramsPerLoad(1e6)).toBeCloseTo(0.1482, 9)
    expect(swdGramsPerLoad(5e9)).toBeCloseTo(741, 9)
  })
})

describe('swdGramsPerView', () => {
  it('is 111.891 g for one gigabyte (148.2 x 0.755)', () => {
    expect(swdGramsPerView(1e9)).toBeCloseTo(111.891, 9)
  })

  it('answers the same number for the same input', () => {
    expect(swdGramsPerView(123_456)).toBe(swdGramsPerView(123_456))
  })

  it('is 0 for an empty page', () => {
    expect(swdGramsPerView(0)).toBe(0)
  })
})

describe('swdMilligramsPerView', () => {
  it('rounds to 0.01 mg', () => {
    expect(swdMilligramsPerView(1e6)).toBe(111.89)
    expect(swdMilligramsPerView(0)).toBe(0)
    expect(swdMilligramsPerView(1)).toBe(0)
  })
})
