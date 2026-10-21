import { COMPILED_DIGEST } from '../../modules/theme/install/constants'
import type { LoadedEntry } from '../../modules/theme/install/types'
import { STATIC_CSP } from '~/constants/security'

// What `/_t/<digest>/…` answers (ADR 0009, section 8): pure, so the route stays thin and the rules are tested without a server.

/** Content type by extension: the only files an entry holds. The type is never derived from the request or the file. */
const CONTENT_TYPES: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  woff: 'font/woff',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
}

/** A file of an entry, ready to send. */
export interface ThemeAsset {
  headers: Record<string, string>
  body: Buffer
}

function accepts(acceptEncoding: string | undefined, coding: string): boolean {
  return (acceptEncoding ?? '').toLowerCase().split(',').some((part) => {
    const [name, ...params] = part.trim().split(';')
    const quality = params.map(param => param.trim()).find(param => param.startsWith('q='))
    return name === coding && (quality === undefined || Number(quality.slice(2)) > 0)
  })
}

/** True for a digest in the grammar of an entry, before anything is looked up. */
export function isEntryDigest(digest: string): boolean {
  return COMPILED_DIGEST.test(digest)
}

/**
 * The file `path` of a verified, in-memory entry, or `null` for any request that is not exactly a file the entry's manifest lists.
 *
 * @remarks
 * A lookup in the verified bytes by the path as given, never a path joined and read from disk, so a file replaced after the entry
 * was loaded is not served and `..` has nothing to match. The manifest and the precompressed copies are not served by name.
 * Brotli or gzip is sent only when the request accepts it, with `Vary`. Every response is immutable (the digest changes with the
 * content), `nosniff` and sandboxed by the static CSP, like `/fonts/**` and `/theme/images/**`.
 *
 * @param acceptEncoding - The `Accept-Encoding` request header.
 */
export function themeAsset(entry: LoadedEntry | undefined, path: string, acceptEncoding: string | undefined): ThemeAsset | null {
  if (entry === undefined || path === 'manifest.json' || /\.(gz|br)$/.test(path)) return null
  const plain = entry.files.get(path)
  const type = CONTENT_TYPES[path.slice(path.lastIndexOf('.') + 1).toLowerCase()]
  if (plain === undefined || type === undefined || !Object.hasOwn(entry.manifest.files, path)) return null
  const br = entry.files.get(`${path}.br`)
  const gz = entry.files.get(`${path}.gz`)
  const encoded = br && accepts(acceptEncoding, 'br') ? { body: br, coding: 'br' } : gz && accepts(acceptEncoding, 'gzip') ? { body: gz, coding: 'gzip' } : null
  const body = encoded?.body ?? plain
  return {
    body,
    headers: {
      'content-type': type,
      'content-length': String(body.length),
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': STATIC_CSP,
      ...(br || gz ? { vary: 'Accept-Encoding' } : {}),
      ...(encoded ? { 'content-encoding': encoded.coding } : {}),
    },
  }
}
