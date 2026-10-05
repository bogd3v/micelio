import { describe, expect, it } from 'vitest'
import { MAX_MODES, buildSegmentedCss, validateModes } from '../modules/theme/modes'
import type { ThemeManifest } from '../modules/theme/themes'

const BOGOTA = [{ id: 'noche', scheme: 'dark' as const }, { id: 'dia', scheme: 'light' as const }]

function manifest(modes: Array<{ id: string, scheme: string }>): ThemeManifest {
  return { id: 'x', contract: 1, fonts: [], modes } as unknown as ThemeManifest
}

describe('segmented control rules', () => {
  const css = buildSegmentedCss(BOGOTA)

  it('presses the current mode and mutes the others, per mode', () => {
    expect(css).toContain('[data-theme="dia"] .bd-seg[data-mode="dia"] {')
    expect(css).toContain('[data-theme="dia"] .bd-seg[data-mode]:not([data-mode="dia"]):hover {')
    expect(css).toContain('[data-theme="noche"] .bd-seg[data-mode="noche"] {')
  })

  it('treats the first mode as the default when the page has no data-theme', () => {
    expect(css).toContain(':root:not([data-theme]) .bd-seg[data-mode="noche"] {')
    expect(css).toContain(':root:not([data-theme]) .bd-seg[data-mode]:not([data-mode="noche"]) {')
    expect(css).not.toContain(':root:not([data-theme]) .bd-seg[data-mode="dia"]')
  })

  it('has no idle rules for a single mode', () => {
    expect(buildSegmentedCss([BOGOTA[1]!])).not.toContain(':not([data-mode=')
  })
})

describe('mode validation', () => {
  it('accepts the Bogota modes', () => {
    expect(() => validateModes(manifest(BOGOTA))).not.toThrow()
  })

  it('rejects a scheme that is not dark or light', () => {
    expect(() => validateModes(manifest([{ id: 'a', scheme: 'sepia' }]))).toThrow('scheme "sepia"')
  })

  it('rejects a repeated mode id', () => {
    expect(() => validateModes(manifest([{ id: 'a', scheme: 'dark' }, { id: 'a', scheme: 'light' }]))).toThrow('declared twice')
  })

  it('rejects more modes than the init script budget allows', () => {
    const many = Array.from({ length: MAX_MODES + 1 }, (_, i) => ({ id: `m${i}`, scheme: 'dark' }))
    expect(() => validateModes(manifest(many))).toThrow(`at most ${MAX_MODES}`)
  })
})
