import { SESSION_COOKIE, SESSION_MAX_AGE } from './auth'
import { READ_STORAGE_KEY } from './readArticles'
import { THEME_STORAGE_KEY } from './theme'

export const PRIVACY_NOTICE_STORAGE_KEY = 'micelio-privacy-notice'
// TODO(#422): remove the bd-privacy-notice fallback
const LEGACY_PRIVACY_NOTICE_STORAGE_KEY = 'bd-privacy-notice'

export interface SiteCookie {
  name: string
  maxAgeDays: number
}

type NoticeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const SITE_COOKIES: SiteCookie[] = [
  { name: SESSION_COOKIE, maxAgeDays: SESSION_MAX_AGE / (60 * 60 * 24) },
]

export const BROWSER_STORAGE_KEYS: string[] = [THEME_STORAGE_KEY, PRIVACY_NOTICE_STORAGE_KEY, READ_STORAGE_KEY]

function browserStorage(): NoticeStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function isPrivacyNoticeDismissed(storage: NoticeStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false
    if (storage.getItem(PRIVACY_NOTICE_STORAGE_KEY) === '1') {
      storage.removeItem(LEGACY_PRIVACY_NOTICE_STORAGE_KEY)
      return true
    }
    // TODO(#422): remove the bd-privacy-notice fallback
    if (storage.getItem(LEGACY_PRIVACY_NOTICE_STORAGE_KEY) !== '1') return false
    dismissPrivacyNotice(storage)
    return true
  } catch {
    return false
  }
}

export function dismissPrivacyNotice(storage: NoticeStorage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(PRIVACY_NOTICE_STORAGE_KEY, '1')
    storage.removeItem(LEGACY_PRIVACY_NOTICE_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
