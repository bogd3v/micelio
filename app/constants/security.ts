/** The `frame-ancestors` directive every response carries, so nothing can be embedded by default (ASVS V3.4.6). */
export const FRAME_ANCESTORS_NONE = 'frame-ancestors \'none\''

/** Where a site publishes its security contact (RFC 9116). */
export const SECURITY_TXT_PATH = '/.well-known/security.txt'

/** Days between the render of `security.txt` and its `Expires` field. */
export const SECURITY_TXT_VALID_DAYS = 180
