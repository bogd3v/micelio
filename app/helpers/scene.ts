// Models of the `scene` section (ADR 0006, section 6; ADR 0004 amendment of #246): binary glTF (.glb) only.

import { MODEL_MAX_BYTES } from '../islands/constants'

const GLB_PATH = /\.glb$/i
// 'glTF' as a little-endian uint32
const GLB_MAGIC = 0x46546C67
const GLB_VERSION = 2

/** Whether a URL (or path) names a `.glb` file: its parsed path ends in `.glb`, so `/api/x?.glb` does not. */
export function isGlbUrl(url: string): boolean {
  return URL.canParse(url, 'http://localhost') && GLB_PATH.test(new URL(url, 'http://localhost').pathname)
}

/** The URL the island may fetch: http(s), a `.glb`, resolved against the page. Anything else (`javascript:`, `data:`, another file type) is undefined. */
export function modelSource(value: string | null | undefined, base: string): URL | undefined {
  if (!value || !URL.canParse(value, base)) return undefined
  const url = new URL(value, base)
  return (url.protocol === 'https:' || url.protocol === 'http:') && isGlbUrl(url.pathname) ? url : undefined
}

/** Whether the bytes are a binary glTF 2: magic, version and a header length equal to the file's. */
export function isGlb(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = bytes instanceof Uint8Array ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new DataView(bytes)
  return view.byteLength >= 12 && view.byteLength <= MODEL_MAX_BYTES && view.getUint32(0, true) === GLB_MAGIC && view.getUint32(4, true) === GLB_VERSION && view.getUint32(8, true) === view.byteLength
}

/** Most memory the accessors of a model may ask for (sparse ones and accessors with no data included), checked before Three.js parses it. */
const MODEL_MAX_ACCESSOR_BYTES = 64 * 1024 * 1024
/** Largest embedded image, in bytes and in pixels (a small file can decode to gigabytes). */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024
const IMAGE_MAX_PIXELS = 4096 * 4096

const JSON_CHUNK = 0x4E4F534A
const BIN_CHUNK = 0x004E4942
const COMPONENT_BYTES: Readonly<Record<number, number>> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_ITEMS: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }

interface GltfJson {
  accessors?: { count?: unknown, type?: unknown, componentType?: unknown, sparse?: { count?: unknown, indices?: { componentType?: unknown } } }[]
  buffers?: { uri?: unknown }[]
  bufferViews?: { byteOffset?: number, byteLength?: number }[]
  images?: { uri?: unknown, bufferView?: number }[]
}

interface Chunks {
  json: GltfJson
  bin: Uint8Array
}

function chunksOf(bytes: ArrayBuffer): Chunks | undefined {
  const view = new DataView(bytes)
  let json: GltfJson | undefined
  let bin = new Uint8Array(0)
  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + length > view.byteLength) return undefined
    if (type === JSON_CHUNK && !json) {
      try {
        json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, start, length))) as GltfJson
      } catch {
        return undefined
      }
    } else if (type === BIN_CHUNK && bin.length === 0) {
      bin = new Uint8Array(bytes, start, length)
    }
    offset = start + length + ((4 - (length % 4)) % 4)
  }
  return json && typeof json === 'object' ? { json, bin } : undefined
}

/** Width and height of a PNG or JPEG, from its header; undefined for any other format. */
export function imageSize(image: Uint8Array): [number, number] | undefined {
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength)
  if (image.length >= 24 && view.getUint32(0) === 0x89504E47 && view.getUint32(12) === 0x49484452) return [view.getUint32(16), view.getUint32(20)]
  if (image.length > 4 && view.getUint16(0) === 0xFFD8) {
    for (let offset = 2; offset + 9 < image.length;) {
      if (image[offset] !== 0xFF) return undefined
      const marker = image[offset + 1]!
      if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) return [view.getUint16(offset + 7), view.getUint16(offset + 5)]
      offset += 2 + view.getUint16(offset + 2)
    }
  }
  return undefined
}

/**
 * Why a model must not be parsed, or undefined when it may be. Three.js allocates what the accessors say, even with no data behind
 * them, so a few hundred bytes of JSON can ask for gigabytes; embedded images can decode to far more than their size; and anything
 * the file points to outside itself is refused. Runs on the raw bytes, before GLTFLoader.
 */
export function glbProblem(bytes: ArrayBuffer): string | undefined {
  const chunks = chunksOf(bytes)
  if (!chunks) return 'unreadable glTF JSON'
  const { json, bin } = chunks
  let total = 0
  for (const accessor of json.accessors ?? []) {
    const items = typeof accessor.type === 'string' ? TYPE_ITEMS[accessor.type] : undefined
    const component = typeof accessor.componentType === 'number' ? COMPONENT_BYTES[accessor.componentType] : undefined
    if (!items || !component || typeof accessor.count !== 'number' || !Number.isInteger(accessor.count) || accessor.count < 0) return 'invalid accessor'
    total += accessor.count * items * component
    if (accessor.sparse) {
      const indices = typeof accessor.sparse.indices?.componentType === 'number' ? COMPONENT_BYTES[accessor.sparse.indices.componentType] : undefined
      if (!indices || typeof accessor.sparse.count !== 'number' || !Number.isInteger(accessor.sparse.count) || accessor.sparse.count < 0) return 'invalid sparse accessor'
      total += accessor.sparse.count * (indices + items * component)
    }
    if (total > MODEL_MAX_ACCESSOR_BYTES) return `accessors ask for more than ${MODEL_MAX_ACCESSOR_BYTES} bytes`
  }
  for (const buffer of json.buffers ?? []) {
    if (buffer.uri !== undefined && !(typeof buffer.uri === 'string' && buffer.uri.startsWith('data:'))) return 'a buffer outside the file'
  }
  for (const image of json.images ?? []) {
    if (image.uri !== undefined) {
      if (!(typeof image.uri === 'string' && image.uri.startsWith('data:'))) return 'an image outside the file'
      if (image.uri.length > IMAGE_MAX_BYTES * 2) return 'image too large'
      continue
    }
    const view = image.bufferView === undefined ? undefined : json.bufferViews?.[image.bufferView]
    if (!view || typeof view.byteLength !== 'number' || view.byteLength > IMAGE_MAX_BYTES) return 'image too large'
    const size = imageSize(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength))
    if (size && size[0] * size[1] > IMAGE_MAX_PIXELS) return 'image too large'
  }
  return undefined
}
