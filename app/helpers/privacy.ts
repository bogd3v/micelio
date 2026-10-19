import type { PrivacyJurisdiction } from '../interfaces/site'
import { SESSION_COOKIE, SESSION_MAX_AGE } from '../constants/auth'
import { READ_STORAGE_KEY } from './readArticles'
import { THEME_STORAGE_KEY } from './theme'

/**
 * Storage key of the dismissed privacy notice.
 *
 * @internal Exported for tests.
 */
export const PRIVACY_NOTICE_STORAGE_KEY = 'micelio-privacy-notice'

interface SiteCookie {
  name: string
  maxAgeDays: number
}

type NoticeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The i18n key of the opening of the rights text for a jurisdiction: the neutral one when the site names none, else the one that cites its law. */
export function privacyRightsLeadKey(jurisdiction: PrivacyJurisdiction | ''): string {
  return jurisdiction ? `privacy.rights.lead${jurisdiction.charAt(0).toUpperCase()}${jurisdiction.slice(1)}` : 'privacy.rights.lead'
}

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
 * Answers false without storage, and when storage throws.
 * `storage` defaults to `localStorage` when the page has one.
 */
export function isPrivacyNoticeDismissed(storage: NoticeStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false
    return storage.getItem(PRIVACY_NOTICE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Stores that the privacy notice was dismissed.
 *
 * @remarks
 * Answers whether the value was stored: false without storage, and when storage throws.
 */
export function dismissPrivacyNotice(storage: NoticeStorage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(PRIVACY_NOTICE_STORAGE_KEY, '1')
    return true
  } catch {
    return false
  }
}
