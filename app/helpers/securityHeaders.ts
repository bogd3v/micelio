export interface ContentSecurityPolicyOptions {
  scriptHashes: string[]
  imageOrigins: string[]
  /** For a `<meta http-equiv>`: without the directives a meta cannot carry (`frame-ancestors`; ADR 0006, section 7). */
  meta?: boolean
  /** `blob:` in `img-src` (default true: the dynamic site's output); static pages do not use it. */
  imageBlobs?: boolean
  /** `'wasm-unsafe-eval'` in `script-src`, for Pagefind's WebAssembly (default false: static builds only; ADR 0004 amendment). */
  wasmEval?: boolean
  /** Extra `form-action` origins: the static newsletter provider (ADR 0004, amendment). Default none. */
  formOrigins?: string[]
}

const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
const SRC_PATTERN = /(?:^|\s)src\s*=/i
const TYPE_PATTERN = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
const EXECUTABLE_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module', 'importmap'])

export const FRAME_ORIGINS = [
  'https://www.youtube.com',
  'https://youtube.com',
  'https://www.youtube-nocookie.com',
  'https://youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://vimeo.com',
]

export const SECURITY_HEADERS: Record<string, string> = {
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
}

function scriptType(attributes: string): string {
  const match = TYPE_PATTERN.exec(attributes)
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim().toLowerCase()
}

export function inlineScripts(html: string): string[] {
  const scripts: string[] = []
  for (const [, attributes = '', content = ''] of html.matchAll(SCRIPT_PATTERN)) {
    if (SRC_PATTERN.test(attributes)) continue
    if (EXECUTABLE_TYPES.has(scriptType(attributes))) scripts.push(content)
  }
  return scripts
}

const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/
const IPV6_PATTERN = /^\[[0-9a-f:.]+\]$/

/** Origin of a URL for a CSP source list, or `''` if its host could change the policy (`*`, `;`, spaces, `%`…). A trailing dot is dropped. */
export function cspOrigin(value: string): string {
  if (!URL.canParse(value)) return ''
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
  const host = url.hostname.replace(/\.$/, '')
  if (!HOST_PATTERN.test(host) && !IPV6_PATTERN.test(host)) return ''
  return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`
}

function origins(urls: string[]): string[] {
  return [...new Set(urls.map(cspOrigin).filter(Boolean))]
}

export function contentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const hashes = [...new Set(options.scriptHashes)].map(hash => `'sha256-${hash}'`)
  const directives: [string, string[]][] = [
    ['default-src', ['\'self\'']],
    ['script-src', ['\'self\'', ...(options.wasmEval ? ['\'wasm-unsafe-eval\''] : []), ...hashes]],
    ['style-src', ['\'self\'', '\'unsafe-inline\'']],
    ['img-src', ['\'self\'', 'data:', ...(options.imageBlobs === false ? [] : ['blob:']), ...origins(options.imageOrigins)]],
    // Videos of page sections (<video>) come from the same origins as the images
    ['media-src', ['\'self\'', ...origins(options.imageOrigins)]],
    ['font-src', ['\'self\'']],
    ['connect-src', ['\'self\'']],
    ['frame-src', FRAME_ORIGINS],
    // `report-uri` and `sandbox` are never emitted; a meta ignores `frame-ancestors`
    ...(options.meta ? [] : [['frame-ancestors', ['\'none\'']] as [string, string[]]]),
    ['base-uri', ['\'self\'']],
    ['form-action', ['\'self\'', ...origins(options.formOrigins ?? [])]],
    ['object-src', ['\'none\'']],
  ]
  return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ')
}
