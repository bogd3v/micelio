import { SECURITY_TXT_PATH, SECURITY_TXT_VALID_DAYS } from '../constants/security'

const DAY_MS = 24 * 60 * 60 * 1000
// The rules of the CMS (`micelio-cms/src/utils/site-security-contact.ts`), applied again for a value that skipped its lifecycle
const MAX_CONTACT_LENGTH = 512
// RFC 3986 characters only: no whitespace, control, bidi or other non-ASCII characters
const URI_CHARACTERS = /^[\w\-.~:/?#[\]@!$&'()*+,;=%]+$/
// Percent-encoded C0 controls and DEL, which a mail client would decode
const ENCODED_CONTROL = /%(?:[01][0-9a-f]|7f)/i
const MAILTO_ADDRESS = /^[^@\s,;%<>]+@[^@\s,;%<>]+\.[^@\s,;%<>]+$/
const MAILTO_SUBJECT = /^subject=[^&]*$/

function isValidContact(value: string): boolean {
  if (value.length > MAX_CONTACT_LENGTH || !URI_CHARACTERS.test(value) || ENCODED_CONTROL.test(value)) return false
  if (value.startsWith('https://')) {
    try {
      const uri = new URL(value)
      return uri.protocol === 'https:' && uri.hostname !== '' && !uri.username && !uri.password
    } catch {
      return false
    }
  }
  if (!value.startsWith('mailto:')) return false
  const [address = '', ...rest] = value.slice('mailto:'.length).split('?')
  // One address; the only header field allowed is `subject`
  return MAILTO_ADDRESS.test(address) && (rest.length === 0 || (rest.length === 1 && MAILTO_SUBJECT.test(rest[0]!)))
}

/** The security contact when it is one `mailto:` address (with at most `?subject=`) or an `https:` URI without credentials, on one line of RFC 3986 characters, at most 512 long; `undefined` otherwise. */
export function validSecurityContact(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const contact = value.trim()
  return isValidContact(contact) ? contact : undefined
}

/**
 * The text of `/.well-known/security.txt` (RFC 9116), or `null` when the site has no valid security contact.
 *
 * @remarks
 * `Expires` is `now` plus `SECURITY_TXT_VALID_DAYS`, so a static site that is not rebuilt for that long serves an expired file.
 *
 * @param contact - The `securityContact` of the site settings, validated again here.
 * @param siteUrl - The site origin, for `Canonical`.
 * @param locales - The site's locale codes, for `Preferred-Languages`.
 * @param now - The render time.
 */
export function securityTxt(contact: unknown, siteUrl: string, locales: readonly string[], now: Date = new Date()): string | null {
  const valid = validSecurityContact(contact)
  if (!valid) return null
  const expires = new Date(now.getTime() + SECURITY_TXT_VALID_DAYS * DAY_MS)
  return [
    `Contact: ${valid}`,
    `Expires: ${expires.toISOString()}`,
    `Preferred-Languages: ${locales.join(', ')}`,
    `Canonical: ${siteUrl.replace(/\/+$/, '')}${SECURITY_TXT_PATH}`,
    '',
  ].join('\n')
}
