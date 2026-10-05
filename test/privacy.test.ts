import { afterEach, describe, it, expect, vi } from 'vitest'
import { BROWSER_STORAGE_KEYS, PRIVACY_NOTICE_STORAGE_KEY, SITE_COOKIES, dismissPrivacyNotice, isPrivacyNoticeDismissed } from '../app/helpers/privacy'
import { migrateStoredMode } from '../app/helpers/theme'

const MODES = [{ id: 'noche', scheme: 'dark' as const }, { id: 'dia', scheme: 'light' as const }]

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

describe('privacy inventory', () => {
  it('lists every browser storage key and cookie the site writes', () => {
    expect(BROWSER_STORAGE_KEYS).toEqual(['bd-theme', 'bd-privacy-notice', 'bd-read-articles'])
    expect(SITE_COOKIES).toEqual([{ name: 'bd_session', maxAgeDays: 7 }])
  })
})

describe('migrateStoredMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function migrate(initial: Record<string, string>): Map<string, string> {
    const storage = memoryStorage(initial)
    vi.stubGlobal('localStorage', storage)
    migrateStoredMode(MODES)
    return storage.data
  }

  it('moves the previous theme key to bd-theme', () => {
    expect(Object.fromEntries(migrate({ 'devbog-theme': 'dia' }))).toEqual({ 'bd-theme': 'dia' })
  })

  it('maps the legacy color mode', () => {
    expect(Object.fromEntries(migrate({ 'devbog-color-mode': 'dark' }))).toEqual({ 'bd-theme': 'noche' })
  })

  it('keeps the current theme and drops the legacy keys', () => {
    expect(Object.fromEntries(migrate({ 'bd-theme': 'noche', 'devbog-theme': 'dia', 'devbog-color-mode': 'light' }))).toEqual({ 'bd-theme': 'noche' })
  })

  it('keeps a stored value that is not a mode, without touching the legacy keys', () => {
    expect(Object.fromEntries(migrate({ 'bd-theme': 'sepia', 'devbog-theme': 'dia' }))).toEqual({ 'bd-theme': 'sepia', 'devbog-theme': 'dia' })
  })

  it('drops invalid legacy values without storing a theme', () => {
    expect(Object.fromEntries(migrate({ 'devbog-theme': 'sepia', 'devbog-color-mode': 'system' }))).toEqual({})
  })

  it('survives blocked storage', () => {
    vi.stubGlobal('localStorage', brokenStorage)
    expect(() => migrateStoredMode(MODES)).not.toThrow()
  })
})
