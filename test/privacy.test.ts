import { describe, it, expect } from 'vitest'
import { BROWSER_STORAGE_KEYS, PRIVACY_NOTICE_STORAGE_KEY, SITE_COOKIES, dismissPrivacyNotice, isPrivacyNoticeDismissed, privacyRightsLeadKey } from '../app/helpers/privacy'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
}

const brokenStorage = {
  getItem: () => { throw new Error('SecurityError') },
  setItem: () => { throw new Error('QuotaExceededError') },
  removeItem: () => { throw new Error('SecurityError') },
}

describe('privacy notice storage', () => {
  it('remembers that the notice was dismissed', () => {
    const storage = memoryStorage()
    expect(isPrivacyNoticeDismissed(storage)).toBe(false)
    expect(dismissPrivacyNotice(storage)).toBe(true)
    expect(storage.data.get(PRIVACY_NOTICE_STORAGE_KEY)).toBe('1')
    expect(isPrivacyNoticeDismissed(storage)).toBe(true)
  })

  it('ignores blocked or missing storage', () => {
    expect(isPrivacyNoticeDismissed(brokenStorage)).toBe(false)
    expect(dismissPrivacyNotice(brokenStorage)).toBe(false)
    expect(isPrivacyNoticeDismissed(null)).toBe(false)
    expect(dismissPrivacyNotice(null)).toBe(false)
  })
})

describe('privacy notice storage, old key', () => {
  it('ignores the pre-rename key', () => {
    const storage = memoryStorage({ 'bd-privacy-notice': '1' })
    expect(isPrivacyNoticeDismissed(storage)).toBe(false)
    expect(Object.fromEntries(storage.data)).toEqual({ 'bd-privacy-notice': '1' })
  })
})

describe('privacy inventory', () => {
  it('lists every browser storage key and cookie the site writes', () => {
    expect(BROWSER_STORAGE_KEYS).toEqual(['micelio-theme', 'micelio-privacy-notice', 'micelio-read-articles'])
    expect(SITE_COOKIES).toEqual([{ name: '__Host-micelio_session', maxAgeDays: 7 }])
  })
})

describe('privacyRightsLeadKey', () => {
  it('names no law when the site has no jurisdiction', () => {
    expect(privacyRightsLeadKey('')).toBe('privacy.rights.lead')
  })

  it('picks the opening that cites the law of the jurisdiction', () => {
    expect(privacyRightsLeadKey('colombia')).toBe('privacy.rights.leadColombia')
  })
})
