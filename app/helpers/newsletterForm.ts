// The external newsletter form of static builds (ADR 0006, section 5; docs/static-mode.md)

export interface HiddenField {
  name: string
  value: string
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const DEFAULT_FIELD = 'email'

/** The form action when it is a usable URL, else `''` (the module is off). `https:` only; `http:` just for loopback, so tests can receive the post. */
export function validFormAction(value: unknown): string {
  if (typeof value !== 'string') return ''
  const action = value.trim()
  if (!URL.canParse(action)) return ''
  const url = new URL(action)
  if (url.username || url.password) return ''
  if (url.protocol === 'https:') return action
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname) ? action : ''
}

/** Origin of a valid action, for `form-action` in the CSP; `''` when the action is not valid. */
export function formActionOrigin(value: unknown): string {
  const action = validFormAction(value)
  return action ? new URL(action).origin : ''
}

/** Name of the provider's email field; `email` when empty. */
export function formFieldName(value: unknown): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_FIELD
}

/** Hidden fields a known provider needs. Buttondown's embed form sends `embed=1` (docs/static-mode.md). */
export function hiddenFields(action: string): HiddenField[] {
  const host = URL.canParse(action) ? new URL(action).hostname : ''
  return host === 'buttondown.com' || host.endsWith('.buttondown.com') ? [{ name: 'embed', value: '1' }] : []
}

/** Host shown on the privacy page: the provider that receives the email. */
export function providerHost(action: string): string {
  return URL.canParse(action) ? new URL(action).hostname : ''
}
