import { SESSION_COOKIE, SESSION_MAX_AGE } from '../constants/auth'
import { READ_STORAGE_KEY } from './readArticles'
import { THEME_STORAGE_KEY } from './theme'

/**
 * Storage key of the dismissed privacy notice.
 *
 * @internal Exported for tests.
 */
export const PRIVACY_NOTICE_STORAGE_KEY = 'micelio-privacy-notice'
// TODO(#422): remove the bd-privacy-notice fallback
const LEGACY_PRIVACY_NOTICE_STORAGE_KEY = 'bd-privacy-notice'

interface SiteCookie {
  name: string
  maxAgeDays: number
}

type NoticeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The cookies the site sets, with their lifetime in days, as the privacy page lists them. */
export const SITE_COOKIES: SiteCookie[] = [
  { name: SESSION_COOKIE, maxAgeDays: SESSION_MAX_AGE / (60 * 60 * 24) },
]

/** The keys the site keeps in the browser's `localStorage`, as the privacy page lists them. */
export const BROWSER_STORAGE_KEYS: string[] = [THEME_STORAGE_KEY, PRIVACY_NOTICE_STORAGE_KEY, READ_STORAGE_KEY]

function browserStorage(): NoticeStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Whether the reader has dismissed the privacy notice.
 *
 * @remarks
 * A value under the legacy key is moved to the current key when found. Answers false without storage, and when storage throws.
 * `storage` defaults to `localStorage` when the page has one.
 */
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

/**
 * Stores that the privacy notice was dismissed, and removes the legacy key.
 *
 * @remarks
 * Answers whether the value was stored: false without storage, and when storage throws.
 */
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
