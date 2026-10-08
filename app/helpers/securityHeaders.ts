import type { HeavyIsland } from '../islands/heavy'

export interface ContentSecurityPolicyOptions {
  scriptHashes: string[]
  imageOrigins: string[]
  /** For a `<meta http-equiv>`: without the directives a meta cannot carry (`frame-ancestors`; ADR 0006, section 7). */
  meta?: boolean
  /** `blob:` in `img-src` (default true: the dynamic site's output); static pages do not use it. */
  imageBlobs?: boolean
  /** `'wasm-unsafe-eval'` in `script-src`, for Pagefind's WebAssembly (default false: static builds only; ADR 0004 amendment). */
  wasmEval?: boolean
  /** `worker-src`: only the pages that render a playground have it (ADR 0004, worker containment). Default none. */
  workerSources?: string[]
  /** Extra `connect-src` sources of a heavy island, after `'self'` (ADR 0006, section 6). Default none. */
  connectSources?: string[]
  /** Extra `form-action` origins: the static newsletter provider (ADR 0004, amendment). Default none. */
  formOrigins?: string[]
}

const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
const SRC_PATTERN = /(?:^|\s)src\s*=/i
const TYPE_PATTERN = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
// `speculationrules` is not executed, but the browser checks it against `script-src`: it is hashed like the rest (ADR 0004 amendment)
const EXECUTABLE_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module', 'importmap', 'speculationrules'])

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
    ['connect-src', [...new Set(['\'self\'', ...(options.connectSources ?? [])])]],
    ['frame-src', FRAME_ORIGINS],
    ...(options.workerSources?.length ? [['worker-src', [...new Set(options.workerSources)]] as [string, string[]]] : []),
    // `report-uri` and `sandbox` are never emitted; a meta ignores `frame-ancestors`
    ...(options.meta ? [] : [['frame-ancestors', ['\'none\'']] as [string, string[]]]),
    ['base-uri', ['\'self\'']],
    ['form-action', ['\'self\'', ...origins(options.formOrigins ?? [])]],
    ['object-src', ['\'none\'']],
  ]
  return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ')
}

/** What the heavy islands in use add to a page's policy (ADR 0006, section 6): the options of `contentSecurityPolicy()`. */
export function islandPolicyOptions(islands: readonly HeavyIsland[]): Pick<ContentSecurityPolicyOptions, 'wasmEval' | 'workerSources' | 'connectSources'> {
  return {
    wasmEval: islands.some(island => island.csp?.wasm === true),
    workerSources: islands.flatMap(island => island.csp?.workerSrc ?? []),
    connectSources: islands.flatMap(island => island.csp?.connectSrc ?? []),
  }
}

const SCENE_TAG = /<micelio-scene\b[^>]*>/gi
const SCENE_MODEL = /\sdata-model="([^"]+)"/

/**
 * Origins the `<micelio-scene data-model>` elements of the HTML fetch their model from, as `connect-src` sources (ADR 0004, amendment of #246).
 * Only an absolute URL on one of the trusted media origins counts; a site path is `'self'` already.
 */
export function sceneModelOrigins(html: string, trusted: readonly string[]): string[] {
  const allowed = new Set(trusted.map(cspOrigin).filter(Boolean))
  const found = new Set<string>()
  for (const [tag] of html.matchAll(SCENE_TAG)) {
    const value = SCENE_MODEL.exec(tag)?.[1]
    const origin = value && /^https?:\/\//i.test(value) ? cspOrigin(value.replaceAll('&amp;', '&')) : ''
    if (origin && allowed.has(origin)) found.add(origin)
  }
  return [...found]
}

/** The islands the HTML renders (their `<micelio-<id>>` element): the pages whose policy they extend. */
export function islandsInHtml(html: string, islands: readonly HeavyIsland[]): HeavyIsland[] {
  return islands.filter(island => new RegExp(`<micelio-${island.id}[\\s>/]`).test(html))
}

/**
 * Where a Worker may fetch its runtime from: the runtimes folder of this site, as an origin and path (a bare path is not a CSP source).
 * `undefined` when the site URL is unset or not a safe origin: there is no safe fallback, `'self'` would let the Worker fetch anything of the site.
 */
export function runtimesSource(siteUrl: string, baseURL = '/'): string | undefined {
  const origin = cspOrigin(siteUrl)
  return origin ? `${origin}${baseURL.replace(/\/+$/, '')}/_islands/runtimes/` : undefined
}

/**
 * The policy of the response that serves a Worker script (`/_islands/workers/*`; ADR 0004, worker containment). A Worker takes its
 * policy from its own response, not from the page: no network except the runtimes folder, and WebAssembly but no `eval()`.
 * `undefined` without a valid site URL (see `runtimesSource()`): the caller must not serve the Worker without a policy.
 */
export function workerPolicy(siteUrl: string, baseURL = '/'): string | undefined {
  const connect = runtimesSource(siteUrl, baseURL)
  return connect ? ['default-src \'none\'', 'script-src \'self\' \'wasm-unsafe-eval\'', `connect-src ${connect}`].join('; ') : undefined
}

/** Whether a request path is a Worker script of the islands. The path is decoded and normalised first, so `/_islands/%77orkers/` and `//_islands/./workers/` count. */
export function isWorkerScriptPath(path: string, baseURL = '/'): boolean {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(`http://localhost${path}`).pathname)
  } catch {
    // Not decodable: treat it as a Worker path, so the policy (or the refusal) applies rather than being skipped
    return /_islands/i.test(path)
  }
  return pathname.replace(/\/{2,}/g, '/').startsWith(`${baseURL.replace(/\/+$/, '')}/_islands/workers/`)
}
