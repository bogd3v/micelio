export interface ContentSecurityPolicyOptions {
  scriptHashes: string[]
  imageOrigins: string[]
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

function origins(urls: string[]): string[] {
  const found = urls.filter(url => URL.canParse(url)).map(url => new URL(url).origin)
  return [...new Set(found)]
}

export function contentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const hashes = [...new Set(options.scriptHashes)].map(hash => `'sha256-${hash}'`)
  const directives: [string, string[]][] = [
    ['default-src', ['\'self\'']],
    ['script-src', ['\'self\'', ...hashes]],
    ['style-src', ['\'self\'', '\'unsafe-inline\'']],
    ['img-src', ['\'self\'', 'data:', 'blob:', ...origins(options.imageOrigins)]],
    // Videos of page sections (<video>) come from the same origins as the images
    ['media-src', ['\'self\'', ...origins(options.imageOrigins)]],
    ['font-src', ['\'self\'']],
    ['connect-src', ['\'self\'']],
    ['frame-src', FRAME_ORIGINS],
    ['frame-ancestors', ['\'none\'']],
    ['base-uri', ['\'self\'']],
    ['form-action', ['\'self\'']],
    ['object-src', ['\'none\'']],
  ]
  return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ')
}
