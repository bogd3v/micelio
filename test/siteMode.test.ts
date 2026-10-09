import { describe, expect, it } from 'vitest'
import { isStaticMode, parseSiteMode, SITE_MODES } from '../app/helpers/siteMode'

describe('parseSiteMode', () => {
  it('lists every mode of the SiteMode union', () => {
    // SiteMode lives in app/interfaces/site.ts; a mode added there must be added to SITE_MODES too
    expect([...SITE_MODES]).toEqual(['dynamic', 'static', 'landing'])
  })

  it('parses the three modes, empty as dynamic, and rejects the rest', () => {
    for (const mode of SITE_MODES) expect(parseSiteMode(mode)).toBe(mode)
    expect(parseSiteMode(undefined)).toBe('dynamic')
    expect(parseSiteMode('')).toBe('dynamic')
    expect(() => parseSiteMode('hybrid')).toThrow(/"hybrid".*dynamic, static, landing/)
  })
})

describe('isStaticMode', () => {
  it('treats static and landing as static', () => {
    expect(SITE_MODES.map(isStaticMode)).toEqual([false, true, true])
  })
})
