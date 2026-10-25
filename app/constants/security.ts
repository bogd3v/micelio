/** The `frame-ancestors` directive every response carries, so nothing can be embedded by default (ASVS V3.4.6). A draft page shown to a preview grant replaces it with the admin origin (ADR 0019). */
export const FRAME_ANCESTORS_NONE = 'frame-ancestors \'none\''

/** Where a site publishes its security contact (RFC 9116). */
export const SECURITY_TXT_PATH = '/.well-known/security.txt'

/** Days between the render of `security.txt` and its `Expires` field. */
export const SECURITY_TXT_VALID_DAYS = 180

/** The policy of a theme's static files (fonts, images, stylesheets): they get no capabilities, so an SVG opened directly cannot run scripts or load anything. */
export const STATIC_CSP = `default-src 'none'; style-src 'unsafe-inline'; ${FRAME_ANCESTORS_NONE}; sandbox`
