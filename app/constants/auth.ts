/** Name of the session cookie. The `__Host-` prefix locks it to this host, so a sibling subdomain cannot set or overwrite it (ASVS V3.3.1). */
export const SESSION_COOKIE = '__Host-micelio_session'

/** Lifetime of the session cookie, in seconds (seven days). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7
