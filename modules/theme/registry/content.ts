import { THEME_JSON } from './constants'
import { UnpackError } from './error'
import { checkSvg } from './svg'

// What a file's bytes must look like for its extension (ADR 0009, section 2): magic numbers, SVG as inert text, bounded JSON

/** Largest `theme.json` or package manifest, in bytes. */
const MAX_JSON_BYTES = 256 * 1024
/** Deepest nesting of `theme.json`, of the package manifest and of any other JSON file of a package. */
const MAX_JSON_DEPTH = 16
/** Keys that could reach an object's prototype if a consumer merged the data. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const ASCII = (text: string): number[] => [...text].map(char => char.charCodeAt(0))
const JPEG = [{ at: 0, bytes: [0xFF, 0xD8, 0xFF] }]
/** A Map, so that an extension such as `constructor` is simply unknown. */
const SIGNATURES = new Map<string, { at: number, bytes: number[] }[]>([
  ['woff2', [{ at: 0, bytes: ASCII('wOF2') }]],
  ['png', [{ at: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }]],
  ['jpg', JPEG],
  ['jpeg', JPEG],
  ['gif', [{ at: 0, bytes: ASCII('GIF8') }]],
  ['webp', [{ at: 0, bytes: ASCII('RIFF') }, { at: 8, bytes: ASCII('WEBP') }]],
])
const AVIF_BRANDS = ['avif', 'avis']

function extension(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1).toLowerCase()
}

/** The deepest nesting of arrays and objects in JSON text, counted without recursion so a hostile file cannot overflow the stack. */
function jsonDepth(source: string): number {
  let depth = 0
  let deepest = 0
  let inString = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (inString) {
      if (char === '\\') i++
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '{' || char === '[') deepest = Math.max(deepest, ++depth)
    else if (char === '}' || char === ']') depth--
  }
  return deepest
}

function utf8(data: Uint8Array, path: string, rule: 'svg' | 'json'): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data)
  } catch {
    throw new UnpackError(rule, 'is not valid UTF-8 text', path)
  }
}

/**
 * Parses JSON from a package after bounding its size (for `theme.json` and the manifest) and its nesting, and refusing the keys
 * `__proto__`, `constructor` and `prototype` at any depth.
 *
 * @param path - The name used in errors.
 * @param capped - Whether the 256 KiB cap applies; nesting and keys are always checked.
 * @throws `UnpackError` with the rule `json`.
 */
export function parseBoundedJson(data: Uint8Array, path: string, capped = true): unknown {
  if (capped && data.length > MAX_JSON_BYTES) throw new UnpackError('json', `is over ${MAX_JSON_BYTES} bytes`, path)
  const source = utf8(data, path, 'json')
  if (jsonDepth(source) > MAX_JSON_DEPTH) throw new UnpackError('json', `is nested deeper than ${MAX_JSON_DEPTH} levels`, path)
  try {
    return JSON.parse(source, (key, value: unknown) => {
      if (FORBIDDEN_KEYS.has(key)) throw new UnpackError('json', `has the key "${key}"`, path)
      return value
    })
  } catch (error) {
    if (error instanceof UnpackError) throw error
    throw new UnpackError('json', `is not valid JSON (${(error as Error).message})`, path)
  }
}

/** Whether the `ftyp` box names `avif` or `avis` as its major brand or among its compatible brands. */
function hasAvifBrand(data: Uint8Array): boolean {
  const view = Buffer.from(data.buffer, data.byteOffset, data.length)
  if (view.length < 16 || view.toString('latin1', 4, 8) !== 'ftyp') return false
  const size = view.readUInt32BE(0)
  if (size < 16 || size > view.length) return false
  const brands = [view.toString('latin1', 8, 12)]
  for (let at = 16; at + 4 <= size; at += 4) brands.push(view.toString('latin1', at, at + 4))
  return brands.some(brand => AVIF_BRANDS.includes(brand))
}

/**
 * Checks that a file's bytes are what its extension says: the magic number of a font or image, an inert SVG, valid bounded JSON.
 *
 * @remarks
 * Files with other extensions (CSS, Vue, text) are not inspected here. `theme.json` is also capped at 256 KiB.
 *
 * @param path - Package path of the file, checked for its extension.
 * @throws `UnpackError` with the rule `magic`, `svg` or `json`.
 */
export function checkContent(path: string, data: Uint8Array): void {
  const ext = extension(path)
  if (ext === 'svg') return checkSvg(utf8(data, path, 'svg'), path)
  if (ext === 'json') {
    parseBoundedJson(data, path, path === THEME_JSON)
    return
  }
  if (ext === 'avif') {
    if (!hasAvifBrand(data)) throw new UnpackError('magic', 'does not start like a .avif file', path)
    return
  }
  const signature = SIGNATURES.get(ext)
  if (signature && !signature.every(({ at, bytes }) => bytes.every((byte, i) => data[at + i] === byte))) {
    throw new UnpackError('magic', `does not start like a .${ext} file`, path)
  }
}
