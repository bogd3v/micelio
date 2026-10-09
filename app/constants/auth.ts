/** Name of the session cookie. */
export const SESSION_COOKIE = 'micelio_session'

/** The pre-rename session cookie: read and cleared, never written. */
// TODO(#422): remove the bd_session fallback
export const LEGACY_SESSION_COOKIE = 'bd_session'

/** Lifetime of the session cookie, in seconds (seven days). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7
