import { IMAGE_FILE } from '../constants'
import { UnpackError } from './error'

// The names a package may hold: which paths are safe (ADR 0009, section 2) and which are on the allowlist (ADR 0008 decision 1)

/** Most path segments of an entry. */
const MAX_PATH_DEPTH = 8
/** Longest entry path, in bytes. */
const MAX_PATH_BYTES = 200
/** Longest path segment, in bytes: the `name` field of a ustar header. */
const MAX_SEGMENT_BYTES = 100
const USTAR_PREFIX_BYTES = 155

/** A path segment: ASCII letters, digits, dot, underscore and hyphen. */
const SEGMENT = /^[A-Za-z0-9._-]+$/
/** A Windows device name, before the first dot of a segment and in any case (`con.css` is `con`). */
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com\d|lpt\d)$/i
/** A file that makes a package a code theme wherever it is, in any case (ADR 0009, section 2). */
const CODE_FILE = /\.(?:vue|[mc]?ts|[mc]?js|jsx|tsx|wasm)$/i
/** Folders whose entries make a package a code theme, matched in any case. */
const CODE_FOLDER = /^(?:slots|templates)(?:\/|$)/i

const ROOT_FILES: readonly string[] = ['theme.json', 'theme.css', 'sections.css', 'fonts.css', 'font-fallbacks.css', 'README.md', 'LICENSE']
const PACKAGE_FOLDERS: readonly string[] = ['fonts', 'images', 'i18n', 'slots', 'templates']
const FONT_PACKAGE_FILE = /^fonts\/[^/]+\.(?:woff2|txt)$/
const MESSAGES_FILE = /^i18n\/[^/]+\.json$/
const SLOT_FILE = /^slots\/[^/]+\.(?:vue|css|ts)$/
const TEMPLATE_FILE = /^templates\/[^/]+$/

/** The name of a path with Unicode normalisation and case folding applied, for telling duplicates apart. */
export function foldedPath(path: string): string {
  return path.normalize('NFKC').toLowerCase()
}

/**
 * Splits a path into the `prefix` and `name` fields of a ustar header, or `null` when no split fits (name 100 bytes, prefix 155).
 *
 * @remarks
 * Any slash that fits will do; the reader joins them back with `/`.
 */
export function splitUstarPath(path: string): { name: string, prefix: string } | null {
  if (Buffer.byteLength(path) <= MAX_SEGMENT_BYTES) return { name: path, prefix: '' }
  for (let slash = path.indexOf('/'); slash >= 0; slash = path.indexOf('/', slash + 1)) {
    const prefix = path.slice(0, slash)
    const name = path.slice(slash + 1)
    if (Buffer.byteLength(prefix) <= USTAR_PREFIX_BYTES && Buffer.byteLength(name) <= MAX_SEGMENT_BYTES) return { name, prefix }
  }
  return null
}

function segmentProblem(segment: string): string | null {
  if (segment === '') return 'has an empty segment'
  if (segment === '.' || segment === '..') return `has the segment "${segment}"`
  if (!SEGMENT.test(segment)) return 'has a segment outside [A-Za-z0-9._-]'
  if (segment.startsWith('.')) return 'is a hidden file (a segment starts with a dot)'
  if (segment.endsWith('.')) return 'has a segment that ends with a dot'
  if (WINDOWS_DEVICE.test(segment.split('.')[0] ?? '')) return 'has a segment that is a Windows device name'
  return null
}

/**
 * The first rule an entry path breaks, or `null`: relative, at most 8 levels and 200 bytes, segments of `[A-Za-z0-9._-]` of at most
 * 100 bytes that do not start or end with a dot and are not Windows device names, and a path that fits a ustar header.
 */
export function pathProblem(path: string): UnpackError | null {
  if (path === '' || path.startsWith('/')) return new UnpackError('path', 'is empty or absolute', path)
  if (Buffer.byteLength(path) > MAX_PATH_BYTES) return new UnpackError('path-length', `is over ${MAX_PATH_BYTES} bytes`, path)
  const segments = path.split('/')
  if (segments.length > MAX_PATH_DEPTH) return new UnpackError('depth', `is deeper than ${MAX_PATH_DEPTH} levels`, path)
  for (const segment of segments) {
    if (Buffer.byteLength(segment) > MAX_SEGMENT_BYTES) return new UnpackError('path-length', `has a segment over ${MAX_SEGMENT_BYTES} bytes`, path)
    const problem = segmentProblem(segment)
    if (problem) return new UnpackError('path', problem, path)
  }
  if (!splitUstarPath(path)) return new UnpackError('path-length', 'does not fit the name and prefix fields of a tar header', path)
  return null
}

/**
 * Whether an entry makes its package a code theme: anything in `slots/` or `templates/`, or a code file anywhere, in any case.
 *
 * @remarks
 * ADR 0009, section 2: decided from the unpacked entries, never from the manifest.
 */
export function isCodePath(path: string): boolean {
  return CODE_FOLDER.test(path) || CODE_FILE.test(path)
}

/** The allowlist of a package (ADR 0008 decision 1, as amended by ADR 0009 section 10); folder names match exactly in lowercase. */
export function isAllowedPath(path: string, type: 'file' | 'directory'): boolean {
  if (type === 'directory') return PACKAGE_FOLDERS.includes(path) || path.startsWith('images/')
  return ROOT_FILES.includes(path) || FONT_PACKAGE_FILE.test(path) || MESSAGES_FILE.test(path) || SLOT_FILE.test(path)
    || TEMPLATE_FILE.test(path) || (path.startsWith('images/') && IMAGE_FILE.test(path))
}
