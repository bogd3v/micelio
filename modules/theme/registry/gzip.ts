import type { ZlibOptions } from 'node:zlib'
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'
import { UnpackError } from './error'

// A gzip member written and read by hand, so the header (and with it the digest) does not depend on the Node version

/** Deflate, no flags, mtime 0, no extra flags, OS "unix": the same ten bytes for every package. */
const HEADER = Buffer.from([0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03])
const TRAILER_BYTES = 8
/** Largest ratio between the unpacked tar and the `.tgz`; a stream that exceeds it is aborted. */
const MAX_COMPRESSION_RATIO = 20
/**
 * Output always allowed whatever the ratio: 200 small files are about 200 KiB of tar, mostly header padding, which compresses
 * far past 20 to 1. A bomb is still stopped at this size.
 */
const RATIO_FLOOR_BYTES = 512 * 1024

/**
 * Compresses `data` into one gzip member, byte for byte the same for the same input and the same zlib.
 *
 * @remarks
 * Level 9, no timestamp, no file name. Different Node or zlib versions may deflate the same input to different bytes: the
 * digest of record is that of the published `.tgz`, not of a rebuild.
 */
export function gzipDeterministic(data: Uint8Array): Buffer {
  const trailer = Buffer.alloc(TRAILER_BYTES)
  trailer.writeUInt32LE(crc32(data), 0)
  trailer.writeUInt32LE(data.length >>> 0, 4)
  return Buffer.concat([HEADER, deflateRawSync(data, { level: 9, memLevel: 8, windowBits: 15 }), trailer])
}

/**
 * Decompresses exactly one plain gzip member, aborting as soon as the output passes `maxOutput` or 20 times the input (and at least `RATIO_FLOOR_BYTES`: a tiny package is mostly tar padding).
 *
 * @param data - The `.tgz`; its header must have no flags (no name, comment or extra field).
 * @param maxOutput - The most bytes the member may inflate to.
 * @throws `UnpackError` with the rule `gzip`, `ratio`, `unpacked-size` or `trailing-data`.
 */
export function gunzipBounded(data: Uint8Array, maxOutput: number): Buffer {
  const input = Buffer.from(data.buffer, data.byteOffset, data.length)
  if (input.length < HEADER.length + TRAILER_BYTES) throw new UnpackError('gzip', 'too short to be a gzip member')
  if (!input.subarray(0, 4).equals(HEADER.subarray(0, 4))) throw new UnpackError('gzip', 'not a gzip member with deflate and no flags')
  const body = input.subarray(HEADER.length)
  const byRatio = Math.max(input.length * MAX_COMPRESSION_RATIO, RATIO_FLOOR_BYTES)
  let inflated: { buffer: Buffer, engine: { bytesWritten: number } }
  try {
    // `info: true` returns the engine next to the buffer, which the typings of Node do not model
    inflated = inflateRawSync(body, { maxOutputLength: Math.min(maxOutput, byRatio), info: true } as ZlibOptions) as unknown as typeof inflated
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
      throw byRatio < maxOutput
        ? new UnpackError('ratio', `inflates to more than ${MAX_COMPRESSION_RATIO} times its compressed size`)
        : new UnpackError('unpacked-size', `inflates to more than ${maxOutput} bytes`)
    }
    throw new UnpackError('gzip', `the deflate stream is invalid (${(error as Error).message})`)
  }
  const consumed = (inflated as Partial<typeof inflated>).engine?.bytesWritten
  if (typeof consumed !== 'number') throw new UnpackError('gzip', 'cannot tell where the deflate stream ends')
  const rest = body.length - consumed
  if (rest < TRAILER_BYTES) throw new UnpackError('gzip', 'the member has no trailer')
  if (rest > TRAILER_BYTES) throw new UnpackError('trailing-data', `${rest - TRAILER_BYTES} bytes after the gzip member`)
  const trailer = body.subarray(consumed)
  if (trailer.readUInt32LE(0) !== crc32(inflated.buffer) || trailer.readUInt32LE(4) !== inflated.buffer.length >>> 0) {
    throw new UnpackError('gzip', 'the checksum or the size in the trailer does not match')
  }
  return inflated.buffer
}
