import { describe, expect, it } from 'vitest'
import { isGlb, isGlbUrl, MODEL_MAX_BYTES } from '../app/helpers/scene'
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
