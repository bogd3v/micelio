import { describe, expect, it } from 'vitest'
import { bombGlb, buildGlb, noisePng, texturedGlb, triangleGlb } from '../e2e/fixtures/glb.mjs'
import { glbProblem, imageSize, isGlb, isGlbUrl, modelSource, MODEL_MAX_BYTES } from '../app/helpers/scene'
import { isCopyableMedia } from '../app/helpers/staticBuild'

/** A minimal binary glTF: the 12-byte header only (what the checks read). */
function glb(options: { magic?: number, version?: number, length?: number, size?: number } = {}): Uint8Array {
  const size = options.size ?? 12
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, options.magic ?? 0x46546C67, true)
  view.setUint32(4, options.version ?? 2, true)
  view.setUint32(8, options.length ?? size, true)
  return bytes
}

describe('isGlbUrl', () => {
  it('accepts .glb with an optional query, in any case', () => {
    for (const url of ['/uploads/a.glb', 'https://cdn.test/a/B.GLB', '/uploads/a.glb?updated=1']) expect(isGlbUrl(url), url).toBe(true)
  })

  it('refuses .gltf, other files and a .glb in the middle of the path', () => {
    for (const url of ['/uploads/a.gltf', '/uploads/a.png', '/uploads/a.glb/x', '/uploads/glb', '/uploads/a.glbx', 'https://cms.test/api/x?.glb', '/api/x?file=a.glb', '/api/x#.glb']) expect(isGlbUrl(url), url).toBe(false)
  })
})

describe('isGlb', () => {
  it('accepts a glTF 2 header whose length is the size of the file', () => {
    expect(isGlb(glb())).toBe(true)
    expect(isGlb(glb({ size: 400 }).buffer)).toBe(true)
  })

  it('refuses another magic, version or length, and a short or oversized file', () => {
    expect(isGlb(glb({ magic: 0x3C68746D }))).toBe(false)
    expect(isGlb(glb({ version: 1 }))).toBe(false)
    expect(isGlb(glb({ length: 99 }))).toBe(false)
    expect(isGlb(new Uint8Array(8))).toBe(false)
    expect(isGlb(glb({ size: MODEL_MAX_BYTES + 1 }))).toBe(false)
  })

  it('reads a view into a bigger buffer from its own offset', () => {
    const buffer = new Uint8Array(40)
    buffer.set(glb({ size: 16 }), 8)
    expect(isGlb(buffer.subarray(8, 24))).toBe(true)
    expect(isGlb(buffer.subarray(0, 16))).toBe(false)
  })
})

describe('isCopyableMedia', () => {
  it('copies images, video and audio by their type', () => {
    for (const type of ['image/png', 'image/svg+xml', 'video/mp4', 'audio/mpeg']) expect(isCopyableMedia(type, 'https://cms.test/uploads/a.bin', new Uint8Array(1)), type).toBe(true)
  })

  it('copies a .glb by its bytes, whatever type the host sends', () => {
    for (const type of ['model/gltf-binary', 'application/octet-stream', '']) expect(isCopyableMedia(type, 'https://cms.test/uploads/a.glb?x=1', glb()), type).toBe(true)
  })

  it('refuses a .glb that is not one, other types, and a .gltf', () => {
    expect(isCopyableMedia('model/gltf-binary', 'https://cms.test/uploads/a.glb', new TextEncoder().encode('<html>'))).toBe(false)
    expect(isCopyableMedia('text/html', 'https://cms.test/uploads/a.html', glb())).toBe(false)
    expect(isCopyableMedia('model/gltf+json', 'https://cms.test/uploads/a.gltf', glb())).toBe(false)
    expect(isCopyableMedia('application/json', 'https://cms.test/uploads/a.json', new TextEncoder().encode('{}'))).toBe(false)
  })
})

describe('modelSource', () => {
  const base = 'https://site.test/showcase'

  it('resolves http(s) .glb URLs against the page', () => {
    expect(modelSource('/_media/ab-m.glb', base)?.href).toBe('https://site.test/_media/ab-m.glb')
    expect(modelSource('https://media.test/a/m.glb?x=1', base)?.origin).toBe('https://media.test')
  })

  it('refuses other schemes, other files and nothing', () => {
    for (const value of ['javascript:alert(1).glb', 'data:model/gltf-binary;base64,AAAA', 'blob:https://site.test/x.glb', '/uploads/m.gltf', '/uploads/m.png', '', null, undefined]) {
      expect(modelSource(value, base), String(value)).toBeUndefined()
    }
  })
})

const bytes = (buffer: Buffer): ArrayBuffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
const POSITIONS = { componentType: 5126, type: 'VEC3' }

describe('glbProblem', () => {
  it('lets the fixtures through: a plain triangle and one with an embedded PNG', () => {
    expect(glbProblem(bytes(triangleGlb()))).toBeUndefined()
    expect(glbProblem(bytes(texturedGlb()))).toBeUndefined()
  })

  it('refuses a few hundred bytes whose accessors ask for gigabytes', () => {
    const bomb = bombGlb()
    expect(bomb.length).toBeLessThan(1000)
    expect(glbProblem(bytes(bomb))).toContain('accessors ask for more')
  })

  it('adds up the accessors, sparse ones included, against the cap', () => {
    const half = { ...POSITIONS, count: 2_000_000 }
    expect(glbProblem(bytes(buildGlb({ accessors: [half, half] })))).toBeUndefined()
    expect(glbProblem(bytes(buildGlb({ accessors: [half, half, half, half] })))).toContain('accessors ask for more')
    expect(glbProblem(bytes(buildGlb({ accessors: [{ ...POSITIONS, count: 3, sparse: { count: 50_000_000, indices: { componentType: 5125 } } }] })))).toContain('accessors ask for more')
  })

  it('refuses accessors it cannot size', () => {
    for (const accessor of [{ ...POSITIONS, count: -1 }, { ...POSITIONS, count: 1.5 }, { ...POSITIONS, count: '3' }, { componentType: 1, type: 'VEC3', count: 3 }, { componentType: 5126, type: 'VEC9', count: 3 }, { ...POSITIONS, count: 3, sparse: { count: 'x', indices: { componentType: 5125 } } }]) {
      expect(glbProblem(bytes(buildGlb({ accessors: [accessor] }))), JSON.stringify(accessor)).toContain('invalid')
    }
  })

  it('refuses buffers and images the file points to outside itself, and accepts data: URLs', () => {
    expect(glbProblem(bytes(buildGlb({ buffers: [{ uri: 'model.bin', byteLength: 3 }] })))).toBe('a buffer outside the file')
    expect(glbProblem(bytes(buildGlb({ buffers: [{ uri: 'data:application/octet-stream;base64,AAAA', byteLength: 3 }] })))).toBeUndefined()
    expect(glbProblem(bytes(texturedGlb({ imageUri: 'https://evil.example/x.png' })))).toBe('an image outside the file')
    expect(glbProblem(bytes(texturedGlb({ imageUri: 'data:image/png;base64,AAAA' })))).toBeUndefined()
  })

  it('refuses an embedded image that is too big in bytes or in pixels', () => {
    const huge = { images: [{ bufferView: 0 }], bufferViews: [{ buffer: 0, byteLength: 9 * 1024 * 1024 }] }
    expect(glbProblem(bytes(buildGlb(huge, Buffer.alloc(9 * 1024 * 1024))))).toBe('image too large')
    const png = noisePng(8, 8)
    png.writeUInt32BE(40_000, 16)
    png.writeUInt32BE(40_000, 20)
    expect(glbProblem(bytes(buildGlb({ images: [{ bufferView: 0 }], bufferViews: [{ buffer: 0, byteLength: png.length }] }, png)))).toBe('image too large')
    expect(glbProblem(bytes(buildGlb({ images: [{ bufferView: 3 }], bufferViews: [] })))).toBe('image too large')
  })

  it('refuses a file whose JSON chunk is broken or runs past the end', () => {
    const broken = Buffer.from(triangleGlb())
    broken.writeUInt32LE(99_999, 12)
    expect(glbProblem(bytes(broken))).toBe('unreadable glTF JSON')
    const text = Buffer.from(triangleGlb())
    text.fill(0x7B, 20, 24)
    expect(glbProblem(bytes(text))).toBe('unreadable glTF JSON')
  })
})

describe('imageSize', () => {
  it('reads PNG and JPEG headers, and nothing else', () => {
    expect(imageSize(noisePng(8, 4))).toEqual([8, 4])
    const jpeg = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 0, 0, 0xFF, 0xC0, 0, 11, 8, 0, 6, 0, 9, 3, 1, 0x11, 0])
    expect(imageSize(jpeg)).toEqual([9, 6])
    expect(imageSize(Uint8Array.from([0xFF, 0xD8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeUndefined()
    expect(imageSize(new TextEncoder().encode('RIFF....WEBPVP8 ........'))).toBeUndefined()
  })
})
