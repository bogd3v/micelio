/** Name of the session cookie. The `__Host-` prefix locks it to this host, so a sibling subdomain cannot set or overwrite it (ASVS V3.3.1). */
export const SESSION_COOKIE = '__Host-micelio_session'

/** The session cookie of the previous release, before the `__Host-` prefix: read and cleared, never written. */
// TODO(#422): remove the micelio_session fallback
export const PREVIOUS_SESSION_COOKIE = 'micelio_session'

/** The pre-rename session cookie: read and cleared, never written. */
// TODO(#422): remove the bd_session fallback
export const LEGACY_SESSION_COOKIE = 'bd_session'

/** Lifetime of the session cookie, in seconds (seven days). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7
