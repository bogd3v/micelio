// Models of the `scene` section (ADR 0006, section 6; ADR 0004 amendment of #246): binary glTF (.glb) only.

/** Largest model the build copies and the island fetches. */
export const MODEL_MAX_BYTES = 20 * 1024 * 1024

const GLB_PATH = /\.glb$/i
// 'glTF' as a little-endian uint32
const GLB_MAGIC = 0x46546C67
const GLB_VERSION = 2

/** Whether a URL (or path) names a `.glb` file: its parsed path ends in `.glb`, so `/api/x?.glb` does not. */
export function isGlbUrl(url: string): boolean {
  return URL.canParse(url, 'http://localhost') && GLB_PATH.test(new URL(url, 'http://localhost').pathname)
}

/** Whether the bytes are a binary glTF 2: magic, version and a header length equal to the file's. */
export function isGlb(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = bytes instanceof Uint8Array ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new DataView(bytes)
  return view.byteLength >= 12 && view.byteLength <= MODEL_MAX_BYTES && view.getUint32(0, true) === GLB_MAGIC && view.getUint32(4, true) === GLB_VERSION && view.getUint32(8, true) === view.byteLength
}
