import { describe, it, expect } from 'vitest'
import { formatDate, formatDotDate, formatDotDateTime } from '~/helpers/formatDate'

describe('formatDate', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatDate(undefined)).toBe('')
    expect(formatDate(null)).toBe('')
  })

  it('formats full style in en-US by default', () => {
    expect(formatDate('2026-07-23T16:35:05.045Z')).toMatch(/July 23, 2026/)
  })

  it('formats full style in es-CO when locale passed', () => {
    expect(formatDate('2026-07-23T16:35:05.045Z', 'full', 'es-CO')).toMatch(/23 de julio de 2026/)
  })

  it('omits the year in abbreviated style', () => {
    expect(formatDate('2026-07-23T16:35:05.045Z', 'abbreviated')).not.toMatch(/2026/)
  })
})

describe('formatDotDate', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatDotDate(undefined)).toBe('')
    expect(formatDotDate(null)).toBe('')
  })

  it('formats as DD.MM.YYYY', () => {
    expect(formatDotDate('2026-09-23T16:35:05.045Z')).toBe('23.09.2026')
  })

  it('uses UTC without a zone', () => {
    expect(formatDotDate('2026-09-24T02:00:00.000Z')).toBe('24.09.2026')
  })

  it('moves the day around midnight with the zone', () => {
    expect(formatDotDate('2026-09-24T04:59:59.000Z', 'America/Bogota')).toBe('23.09.2026')
    expect(formatDotDate('2026-09-24T05:00:00.000Z', 'America/Bogota')).toBe('24.09.2026')
    expect(formatDotDate('2026-09-23T23:59:59.000Z', 'UTC')).toBe('23.09.2026')
    expect(formatDotDate('2026-09-24T00:00:00.000Z', 'UTC')).toBe('24.09.2026')
  })
})

describe('formatDotDateTime', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatDotDateTime(undefined)).toBe('')
    expect(formatDotDateTime(null)).toBe('')
  })

  it('uses UTC without a zone', () => {
    expect(formatDotDateTime('2026-09-24T02:30:00.000Z')).toBe('24.09.2026 · 02:30')
  })

  it('shows the date and the 24-hour clock of the zone', () => {
    expect(formatDotDateTime('2026-09-24T02:30:00.000Z', 'America/Bogota')).toBe('23.09.2026 · 21:30')
    expect(formatDotDateTime('2026-09-24T05:00:00.000Z', 'America/Bogota')).toBe('24.09.2026 · 00:00')
  })
})
