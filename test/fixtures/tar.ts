import { gzipSync } from 'node:zlib'

// Hand-built tar and gzip bytes for the unpack tests: they do not use the packer, so a bug in both cannot hide itself.

export interface RawEntry {
  name: string
  /** The type flag; `'0'` (a file) by default. */
  type?: string
  data?: Uint8Array | string
  mode?: number
  /** Written to the `size` field instead of the data length. */
  size?: number
  linkname?: string
  /** The 8 bytes of magic and version; `ustar\x0000` by default. */
  magic?: string
}

function put(header: Buffer, at: number, value: string | Buffer, length: number): void {
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : value
  if (bytes.length > length) throw new Error(`"${String(value)}" does not fit in ${length} bytes`)
  bytes.copy(header, at)
}

function octal(value: number, length: number): string {
  return `${value.toString(8).padStart(length - 1, '0')}\0`
}

/** Splits a long path across `name` and `prefix` like a ustar writer does. */
function split(path: string): { name: string, prefix: string } {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' }
  const slash = path.lastIndexOf('/', 155)
  return { name: path.slice(slash + 1), prefix: path.slice(0, slash) }
}

export function rawEntry(entry: RawEntry): Buffer {
  const data = typeof entry.data === 'string' ? Buffer.from(entry.data) : Buffer.from(entry.data ?? [])
  const { name, prefix } = split(entry.name)
  const header = Buffer.alloc(512)
  put(header, 0, name, 100)
  put(header, 100, octal(entry.mode ?? 0o644, 8), 8)
  put(header, 108, octal(0, 8), 8)
  put(header, 116, octal(0, 8), 8)
  put(header, 124, octal(entry.size ?? data.length, 12), 12)
  put(header, 136, octal(0, 12), 12)
  put(header, 148, '        ', 8)
  put(header, 156, entry.type ?? '0', 1)
  put(header, 157, entry.linkname ?? '', 100)
  put(header, 257, entry.magic ?? 'ustar\x0000', 8)
  put(header, 345, prefix, 155)
  const sum = header.reduce((total, byte) => total + byte, 0)
  put(header, 148, `${sum.toString(8).padStart(6, '0')}\0 `, 8)
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)])
}

/** A tar of the entries followed by `end` (two zero blocks by default). */
export function rawTar(entries: RawEntry[], end: Buffer = Buffer.alloc(1024)): Buffer {
  return Buffer.concat([...entries.map(rawEntry), end])
}

/** Plain gzip by Node: one member, no flags. */
export function tgz(tar: Buffer): Buffer {
  return gzipSync(tar)
}

/** The smallest `theme.json` the unpack accepts. */
export const THEME_JSON_TEXT = JSON.stringify({ id: 'sample', name: 'Sample', version: '1.0.0' })

/** A package of `files` (plus a `theme.json` when none is given), hand-built. */
export function packageOf(files: Record<string, string | Uint8Array> = {}): Buffer {
  const all = 'theme.json' in files ? files : { 'theme.json': THEME_JSON_TEXT, ...files }
  return tgz(rawTar(Object.entries(all).map(([name, data]) => ({ name, data }))))
}

/** A deterministic stream of bytes drawn from 8 symbols: it compresses about 2.7 to 1, far from a bomb. */
export function noise(length: number, seed = 1): Buffer {
  const out = Buffer.alloc(length)
  let state = seed
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    out[i] = 97 + ((state >>> 24) & 7)
  }
  return out
}

export const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
export const JPG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0])
export const GIF = Buffer.from('GIF89a\0\0')
export const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')])
export const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x10]), Buffer.from('ftypavif'), Buffer.alloc(4)])
export const WOFF2 = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(8)])
