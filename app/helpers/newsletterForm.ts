import { cspOrigin } from './securityHeaders'

// The external newsletter form of static builds (ADR 0006, section 5; docs/operate/static-site.md)

interface HiddenField {
  name: string
  value: string
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const DEFAULT_FIELD = 'email'

function hasControlOrSpace(text: string): boolean {
  return [...text].some(char => char.charCodeAt(0) <= 0x20 || char.charCodeAt(0) === 0x7f)
}
const DOTTED_HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/

/** The form action (normalized `href`) when it is a usable URL, else `''` (the module is off). `https:` only; `http:` just for loopback, so tests can receive the post. */
export function validFormAction(value: unknown): string {
  if (typeof value !== 'string') return ''
  const action = value.trim()
  // Control characters, spaces and any `@` before the path (credentials, even empty) are never legitimate here
  if (hasControlOrSpace(action) || /^[a-z]+:\/\/[^/?#]*@/i.test(action)) return ''
  if (!URL.canParse(action)) return ''
  const url = new URL(action)
  if (url.username || url.password) return ''
  const host = url.hostname.replace(/\.$/, '')
  const publicHost = DOTTED_HOST.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[[0-9a-f:.]+\]$/.test(host)
  if (url.protocol === 'https:') return publicHost && cspOrigin(action) ? url.href : ''
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname) ? url.href : ''
}

/** Origin of a valid action, for `form-action` in the CSP; `''` when the action is not valid. */
export function formActionOrigin(value: unknown): string {
  const action = validFormAction(value)
  return action ? cspOrigin(action) : ''
}

/** Name of the provider's email field; `email` when empty. */
export function formFieldName(value: unknown): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_FIELD
}

/** Hidden fields a known provider needs. Buttondown's embed form sends `embed=1` (docs/operate/static-site.md). */
export function hiddenFields(action: string): HiddenField[] {
  const host = URL.canParse(action) ? new URL(action).hostname : ''
  return host === 'buttondown.com' || host.endsWith('.buttondown.com') ? [{ name: 'embed', value: '1' }] : []
}

/** Host shown on the privacy page: the provider that receives the email. */
export function providerHost(action: string): string {
  if (!URL.canParse(action)) return ''
  // Punycode (IDN) hosts are shown as the visitor would read them
  const host = new URL(action).hostname
  return host.split('.').map(label => (label.startsWith('xn--') ? decodePunycode(label.slice(4)) : label)).join('.')
}

// RFC 3492 decoder, small enough to avoid a dependency in client code
function decodePunycode(input: string): string {
  const base = 36
  const output: number[] = []
  const delimiter = input.lastIndexOf('-')
  for (let i = 0; i < Math.max(delimiter, 0); i++) output.push(input.charCodeAt(i))
  let n = 128
  let bias = 72
  let i = 0
  let index = delimiter > 0 ? delimiter + 1 : 0
  while (index < input.length) {
    const oldI = i
    let w = 1
    for (let k = base; ; k += base) {
      const code = input.charCodeAt(index++)
      const digit = code - 48 < 10 ? code - 22 : code - 65 < 26 ? code - 65 : code - 97 < 26 ? code - 97 : base
      if (digit >= base) return input
      i += digit * w
      const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias
      if (digit < t) break
      w *= base - t
    }
    const length = output.length + 1
    let delta = oldI === 0 ? Math.floor((i - oldI) / 700) : Math.floor((i - oldI) / 2)
    delta += Math.floor(delta / length)
    let k = 0
    while (delta > 455) {
      delta = Math.floor(delta / 35)
      k += base
    }
    bias = k + Math.floor((36 * delta) / (delta + 38))
    n += Math.floor(i / length)
    i %= length
    output.splice(i++, 0, n)
  }
  return String.fromCodePoint(...output)
}
