import { MAX_ENTRIES, MAX_FILE_BYTES, MAX_UNPACKED_BYTES } from './constants'
import { UnpackError } from './error'
import { foldedPath, pathProblem, splitUstarPath } from './paths'

/** A file or directory read from a tar. */
export interface TarEntry {
  path: string
  type: 'file' | 'directory'
  /** The file's bytes, a view of the tar; empty for a directory. */
  data: Uint8Array
}

// A ustar reader and writer. The reader takes only what the writer makes: plain files and directories, names in the
// `name` and `prefix` fields. Every extension (pax, GNU long names) is refused, not interpreted.

const BLOCK = 512
const REGULAR = new Set(['0', '\0'])
const REJECTED_TYPES = new Map<string, string>(Object.entries({
  1: 'a hard link', 2: 'a symlink', 3: 'a character device', 4: 'a block device', 6: 'a FIFO', 7: 'a contiguous file',
  x: 'a pax extended header', g: 'a pax global header', L: 'a GNU long name', K: 'a GNU long link name', S: 'a sparse file',
  D: 'a GNU directory dump', M: 'a multi-volume entry', N: 'a GNU old name', V: 'a volume label',
}))
const MODE_FILE = 0o644
const MTIME = 0

function octal(field: Uint8Array, what: string, path: string | null): number {
  const text = Buffer.from(field).toString('latin1').replace(/[\0 ]+$/, '').replace(/^ +/, '')
  if (!/^[0-7]+$/.test(text)) throw new UnpackError('tar', `${what} is not an octal number`, path)
  return Number.parseInt(text, 8)
}

function text(block: Uint8Array, start: number, length: number, what: string): string {
  const field = Buffer.from(block.subarray(start, start + length))
  const end = field.indexOf(0)
  if (end >= 0 && field.subarray(end).some(byte => byte !== 0)) throw new UnpackError('tar', `${what} has bytes after its end`)
  return field.subarray(0, end < 0 ? field.length : end).toString('latin1')
}

function isZero(bytes: Uint8Array): boolean {
  return bytes.every(byte => byte === 0)
}

function checksum(block: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : (block[i] ?? 0)
  return sum
}

/** Registers a path so that names that fold to the same text, or a file used as a folder, are refused. */
function register(seen: Map<string, 'file' | 'explicit' | 'implied'>, path: string, type: TarEntry['type']): void {
  const parts = path.split('/')
  for (let i = 1; i < parts.length; i++) {
    const key = foldedPath(parts.slice(0, i).join('/'))
    const kind = seen.get(key)
    if (kind === 'file') throw new UnpackError('duplicate', 'is inside a path that is also a file', path)
    if (!kind) seen.set(key, 'implied')
  }
  const key = foldedPath(path)
  const kind = seen.get(key)
  if (kind === 'file' || kind === 'explicit' || (kind === 'implied' && type === 'file')) {
    throw new UnpackError('duplicate', 'is the same name as another entry after case folding and Unicode normalisation', path)
  }
  seen.set(key, type === 'file' ? 'file' : 'explicit')
}

function readHeader(block: Uint8Array): { path: string, type: TarEntry['type'], size: number } {
  const stored = octal(block.subarray(148, 156), 'the header checksum', null)
  if (stored !== checksum(block)) throw new UnpackError('tar', 'a header checksum does not match')
  const typeflag = String.fromCharCode(block[156] ?? 0)
  const name = text(block, 0, 100, 'a name')
  const prefix = text(block, 345, 155, 'a name prefix')
  const path = prefix ? `${prefix}/${name}` : name
  const rejected = REJECTED_TYPES.get(typeflag)
  if (rejected) throw new UnpackError('entry-type', `is ${rejected}; only regular files and directories are accepted`, path)
  const isFile = REGULAR.has(typeflag)
  if (!isFile && typeflag !== '5') throw new UnpackError('entry-type', `has the unknown type flag ${JSON.stringify(typeflag)}`, path)
  if (Buffer.from(block.subarray(257, 265)).toString('latin1') !== 'ustar\x0000') throw new UnpackError('tar', 'is not a ustar header', path)
  if (text(block, 157, 100, 'a link name') !== '') throw new UnpackError('entry-type', 'has a link name', path)
  const mode = octal(block.subarray(100, 108), 'the mode', path)
  if (isFile ? mode & 0o7111 : mode & 0o7000) throw new UnpackError('mode', `has the mode ${mode.toString(8)}: executable or special bits are not accepted`, path)
  const size = octal(block.subarray(124, 136), 'the size', path)
  if (!isFile && size !== 0) throw new UnpackError('tar', 'is a directory with a size', path)
  if (isFile && path.endsWith('/')) throw new UnpackError('path', 'is a file whose name ends with a slash', path)
  return { path: isFile ? path : path.replace(/\/$/, ''), type: isFile ? 'file' : 'directory', size }
}

/**
 * Reads a tar into its entries, refusing everything that is not a plain file or directory with a valid, unique, relative path.
 *
 * @remarks
 * The caps of ADR 0008 and ADR 0009 (200 entries, 1 MiB per file, 4 MiB in all) are enforced while reading, before a file's bytes
 * are touched. The end of the archive is two zero blocks followed by nothing but zeros.
 *
 * @throws `UnpackError` for the first rule an entry breaks.
 */
export function readTar(tar: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = []
  const seen = new Map<string, 'file' | 'explicit' | 'implied'>()
  let total = 0
  let offset = 0
  for (;;) {
    if (offset + BLOCK > tar.length) throw new UnpackError('tar', 'ends without the end-of-archive marker')
    const block = tar.subarray(offset, offset + BLOCK)
    if (isZero(block)) break
    if (entries.length >= MAX_ENTRIES) throw new UnpackError('entries', `has more than ${MAX_ENTRIES} entries`)
    const { path, type, size } = readHeader(block)
    const problem = pathProblem(path)
    if (problem) throw problem
    if (size > MAX_FILE_BYTES) throw new UnpackError('file-size', `is ${size} bytes; the limit is ${MAX_FILE_BYTES}`, path)
    total += size
    if (total > MAX_UNPACKED_BYTES) throw new UnpackError('unpacked-size', `the files add up to more than ${MAX_UNPACKED_BYTES} bytes`, path)
    register(seen, path, type)
    const start = offset + BLOCK
    const next = start + Math.ceil(size / BLOCK) * BLOCK
    if (next > tar.length) throw new UnpackError('tar', 'is cut short', path)
    entries.push({ path, type, data: tar.subarray(start, start + size) })
    offset = next
  }
  if (offset + 2 * BLOCK > tar.length) throw new UnpackError('tar', 'ends with one zero block, not two')
  if (!isZero(tar.subarray(offset))) throw new UnpackError('trailing-data', 'has data after the end-of-archive marker')
  return entries
}

function field(value: string, length: number): Buffer {
  const bytes = Buffer.from(value, 'latin1')
  if (bytes.length > length) throw new RangeError(`"${value}" does not fit in ${length} bytes`)
  return Buffer.concat([bytes, Buffer.alloc(length - bytes.length)])
}

function number(value: number, length: number): Buffer {
  return field(`${value.toString(8).padStart(length - 1, '0')}`, length)
}

/**
 * Writes files into a ustar tar in the order given: owner, group, mtime and mode are fixed, so the same files make the same bytes.
 *
 * @remarks
 * Only regular files, with the path split across the `prefix` and `name` fields (`splitUstarPath`; check `pathProblem` first, a path
 * that does not fit throws `RangeError`). No directory
 * entries: a reader makes the folders a file needs. Mode `0644`, uid and gid 0, mtime 0, no user or group names.
 */
export function writeTar(files: ReadonlyArray<{ path: string, data: Uint8Array }>): Buffer {
  const parts: Buffer[] = []
  for (const { path, data } of files) {
    const split = splitUstarPath(path)
    if (!split) throw new RangeError(`"${path}" does not fit in a ustar name`)
    const { name, prefix } = split
    const header = Buffer.alloc(BLOCK)
    const fields: Array<[number, Buffer]> = [
      [0, field(name, 100)], [100, number(MODE_FILE, 8)], [108, number(0, 8)], [116, number(0, 8)], [124, number(data.length, 12)],
      [136, number(MTIME, 12)], [148, Buffer.from('        ', 'latin1')], [156, Buffer.from('0', 'latin1')], [257, Buffer.from('ustar\x0000', 'latin1')],
      [345, field(prefix, 155)],
    ]
    for (const [at, bytes] of fields) bytes.copy(header, at)
    header.write(`${checksum(header).toString(8).padStart(6, '0')}\0 `, 148, 'latin1')
    parts.push(header, Buffer.from(data), Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK))
  }
  parts.push(Buffer.alloc(2 * BLOCK))
  return Buffer.concat(parts)
}
