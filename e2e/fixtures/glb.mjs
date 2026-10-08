// A one-triangle binary glTF, built here so no binary is committed (our own work, AGPL like the rest). ~700 bytes.
// The mock Strapi serves it for every `*.glb` under /uploads/ (e2e/mock-strapi.mjs).

const GLB_MAGIC = 0x46546C67
const JSON_CHUNK = 0x4E4F534A
const BIN_CHUNK = 0x004E4942

function pad(buffer, byte) {
  const rest = (4 - (buffer.length % 4)) % 4
  return rest ? Buffer.concat([buffer, Buffer.alloc(rest, byte)]) : buffer
}

export function triangleGlb() {
  const positions = Buffer.alloc(36)
  ;[-1, -1, 0, 1, -1, 0, 0, 1, 0].forEach((value, index) => positions.writeFloatLE(value, index * 4))
  const gltf = {
    asset: { version: '2.0', generator: 'micelio e2e' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.1, 0.8, 0.3, 1], metallicFactor: 0, roughnessFactor: 0.8 }, doubleSided: true }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length, target: 34962 }],
    buffers: [{ byteLength: positions.length }],
  }
  const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20)
  const bin = pad(positions, 0)
  const total = 12 + 8 + json.length + 8 + bin.length
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
  return Buffer.concat([header, chunk(json.length, JSON_CHUNK), json, chunk(bin.length, BIN_CHUNK), bin])
}
