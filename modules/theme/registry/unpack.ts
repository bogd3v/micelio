import { createHash } from 'node:crypto'
import { checkContent, parseBoundedJson } from './content'
import { MAX_ENTRIES, MAX_UNPACKED_BYTES, THEME_JSON } from './constants'
import { UnpackError } from './error'
import { gunzipBounded } from './gzip'
import { isAllowedPath, isCodePath } from './paths'
import { readTar } from './tar'
import type { UnpackedTheme, UnpackOptions } from './types'

// The safe unpack of a theme package (ADR 0009, section 2). It works on one buffer, writes nothing and runs in plain Node and in Nitro.

/** Largest `.tgz` read at all, checked before anything is decompressed. */
const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024
/** The largest tar a valid package can make: the files, a header and padding per entry, and the end marker. */
const MAX_TAR_BYTES = MAX_UNPACKED_BYTES + (MAX_ENTRIES + 2) * 1024
/** The format of a package digest: `sha256:` and 64 lowercase hex digits. */
const DIGEST = /^sha256:[0-9a-f]{64}$/

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** Checks the files against the sibling manifest; it is informative, so a package without one is still fully verified. */
function verifyManifest(raw: string | Uint8Array, files: Map<string, Uint8Array>, code: boolean): void {
  const manifest = record(parseBoundedJson(typeof raw === 'string' ? new TextEncoder().encode(raw) : raw, 'manifest'))
  const listed = Array.isArray(manifest?.files) ? manifest.files as unknown[] : null
  if (!manifest || !listed) throw new UnpackError('manifest', 'has no "files" list')
  const expected = new Map<string, Record<string, unknown>>()
  for (const item of listed) {
    const file = record(item)
    if (!file || typeof file.path !== 'string') throw new UnpackError('manifest', 'has a file entry without a path')
    if (expected.has(file.path)) throw new UnpackError('manifest', 'is listed twice in the manifest', file.path)
    expected.set(file.path, file)
  }
  for (const path of expected.keys()) if (!files.has(path)) throw new UnpackError('manifest', 'is listed in the manifest but not in the package', path)
  for (const [path, data] of files) {
    const file = expected.get(path)
    if (!file) throw new UnpackError('manifest', 'is in the package but not in the manifest', path)
    if (file.size !== data.length) throw new UnpackError('manifest', `has ${data.length} bytes, the manifest says ${String(file.size)}`, path)
    if (file.sha256 !== sha256(data)) throw new UnpackError('manifest', 'does not match the sha256 in the manifest', path)
  }
  if (typeof manifest.code !== 'boolean') throw new UnpackError('manifest', 'has no boolean "code"')
  if (manifest.code !== code) throw new UnpackError('manifest', `says code is ${String(manifest.code)} but the files make it ${code}`)
  const theme = record(parseBoundedJson(files.get(THEME_JSON) ?? new Uint8Array(), THEME_JSON))
  for (const key of ['id', 'version']) {
    const value = theme?.[key]
    if (typeof value !== 'string' || value === '' || manifest[key] !== value) throw new UnpackError('manifest', `names another ${key} than theme.json, or none`)
  }
}

/**
 * Verifies and unpacks a theme package held in memory, with no pinned digest: for a package this process has just built.
 *
 * @remarks
 * Every rule of `unpackTheme` applies except the digest. A package that comes from anywhere else must go through `unpackTheme`,
 * which requires the digest the caller pinned.
 *
 * @internal Exported for the packer's self-check and for tests.
 * @throws `UnpackError` for the first rule the package breaks.
 */
export function unpackOwnTheme(data: Uint8Array, options: Partial<UnpackOptions> = {}): UnpackedTheme {
  if (data.length > MAX_COMPRESSED_BYTES) throw new UnpackError('compressed-size', `is ${data.length} bytes; the limit is ${MAX_COMPRESSED_BYTES}`)
  const digest = `sha256:${sha256(data)}`
  if (options.digest !== undefined && (!DIGEST.test(options.digest) || options.digest !== digest)) {
    throw new UnpackError('digest', `the package is ${digest}, not the expected digest`)
  }
  const files = new Map<string, Uint8Array>()
  let code = false
  let size = 0
  for (const entry of readTar(gunzipBounded(data, MAX_TAR_BYTES))) {
    code ||= isCodePath(entry.path)
    if (!isAllowedPath(entry.path, entry.type)) throw new UnpackError('allowlist', 'is not a file a theme package may hold', entry.path)
    if (entry.type === 'directory') continue
    checkContent(entry.path, entry.data)
    files.set(entry.path, entry.data.slice())
    size += entry.data.length
  }
  if (!files.has(THEME_JSON)) throw new UnpackError('missing', 'the package has no theme.json', THEME_JSON)
  if (options.manifest !== undefined) verifyManifest(options.manifest, files, code)
  return { files, code, digest, size }
}

/**
 * Verifies and unpacks a theme package held in memory against the digest the caller pinned, or throws the rule it broke and the path.
 *
 * @remarks
 * Order: size of the `.tgz`, its digest, one gzip member inflated within the caps (20:1 ratio above 512 KiB of output, 4 MiB), the
 * tar read with the path rules, then the allowlist and the content of every file, and the manifest when given. `code` comes from
 * the entries, never from the manifest. The files and the digest come from the same buffer, which is never read again by path.
 * The size and ratio caps apply to a buffer already in memory: a client that downloads the package must stop reading at 2 MiB
 * itself, while streaming.
 *
 * @param data - The exact bytes of the `.tgz`, in a buffer this process owns: not a view on a `SharedArrayBuffer` or on memory that
 * another thread can change while the digest is computed and the files are read.
 * @param options - The `digest` the pin names (required: it is the trust anchor) and, optionally, the sibling manifest.
 * @throws `UnpackError` for the first rule the package breaks, `digest` included when none is given.
 */
export function unpackTheme(data: Uint8Array, options: UnpackOptions): UnpackedTheme {
  if (typeof (options as Partial<UnpackOptions> | undefined)?.digest !== 'string') throw new UnpackError('digest', 'a digest is required to unpack a package')
  return unpackOwnTheme(data, options)
}
