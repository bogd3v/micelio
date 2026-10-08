import { deflateSync } from 'node:zlib'

// Binary glTF fixtures, built here (our own work, AGPL like the rest). The mock Strapi serves them under /uploads/ (e2e/mock-strapi.mjs):
// `triangle.glb` is also committed once, as 592 bytes, for the /_theme specimen (modules/theme/specimen/media/); `textured.glb`
// carries a PNG in a bufferView; the hostile ones (`bomb.glb`, `external.glb`) must end on the poster.

const GLB_MAGIC = 0x46546C67
const JSON_CHUNK = 0x4E4F534A
const BIN_CHUNK = 0x004E4942

function pad(buffer, byte) {
  const rest = (4 - (buffer.length % 4)) % 4
  return rest ? Buffer.concat([buffer, Buffer.alloc(rest, byte)]) : buffer
}

function floats(values) {
  const buffer = Buffer.alloc(values.length * 4)
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4))
  return buffer
}

/** A .glb from a glTF object and the bytes of its binary chunk. */
export function buildGlb(gltf, bin = Buffer.alloc(0)) {
  const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20)
  const body = pad(bin, 0)
  const total = 12 + 8 + json.length + (body.length ? 8 + body.length : 0)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(GLB_MAGIC, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(total, 8)
  const chunk = (length, type) => {
    const head = Buffer.alloc(8)
    head.writeUInt32LE(length, 0)
    head.writeUInt32LE(type, 4)
    return head
  }
  return Buffer.concat([header, chunk(json.length, JSON_CHUNK), json, ...(body.length ? [chunk(body.length, BIN_CHUNK), body] : [])])
}

const TRIANGLE = [-1, -1, 0, 1, -1, 0, 0, 1, 0]
const GREEN = { baseColorFactor: [0.1, 0.8, 0.3, 1], metallicFactor: 0, roughnessFactor: 0.8 }

function triangleGltf(extra = {}) {
  return {
    asset: { version: '2.0', generator: 'micelio e2e' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: GREEN, doubleSided: true }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 }],
    buffers: [{ byteLength: 36 }],
    ...extra,
  }
}

export function triangleGlb() {
  return buildGlb(triangleGltf(), floats(TRIANGLE))
}

/**
 * The triangle with a texture: an 8x8 PNG inside the file (a bufferView), or, with `imageUri`, an image the file points to outside itself.
 * Embedded images are what the static policy (no `blob:` in img-src) must still allow, through data: URLs.
 */
export function texturedGlb({ imageUri } = {}) {
  const positions = floats(TRIANGLE)
  const uvs = floats([0, 0, 1, 0, 0.5, 1])
  const png = pad(noisePng(8, 8), 0)
  const image = imageUri ? { uri: imageUri } : { bufferView: 2, mimeType: 'image/png' }
  const gltf = triangleGltf({
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.8 }, doubleSided: true }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 24, target: 34962 },
      { buffer: 0, byteOffset: 60, byteLength: png.length },
    ],
    buffers: [{ byteLength: 60 + png.length }],
    textures: [{ source: 0 }],
    images: [image],
  })
  return buildGlb(gltf, Buffer.concat([positions, uvs, png]))
}

/** A few hundred bytes whose accessors ask for 24 GB (no bufferView, so Three.js would allocate zeros): it must be refused before parsing. */
export function bombGlb() {
  return buildGlb(triangleGltf({
    accessors: [{ componentType: 5126, count: 2_000_000_000, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }],
  }), floats(TRIANGLE))
}

// A PNG of colored noise (~170 KB). Chrome ignores low-entropy images as LCP candidates, which the mock's 1x1 pixel is
export function noisePng(width = 320, height = 180) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buffer) => {
    let c = 0xFFFFFFFF
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'latin1')
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0)
    return Buffer.concat([head, data, tail])
  }
  const rows = Buffer.alloc((width * 3 + 1) * height)
  // Deterministic noise: the same bytes on every run
  let seed = 12345
  for (let i = 0; i < rows.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    rows[i] = i % (width * 3 + 1) === 0 ? 0 : seed >>> 24
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}
