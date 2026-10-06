import { describe, expect, it } from 'vitest'
import { buildSegmentedCss } from '../modules/theme/modes'

const BOGOTA = [{ id: 'noche', scheme: 'dark' as const }, { id: 'dia', scheme: 'light' as const }]

describe('segmented control rules', () => {
  const css = buildSegmentedCss(BOGOTA)

  it('presses the current mode and mutes the others, per mode', () => {
    expect(css).toContain('[data-theme="dia"] .bd-seg[data-mode="dia"]')
    expect(css).toContain('[data-theme="dia"] .bd-seg[data-mode]:not([data-mode="dia"]):hover')
    expect(css).toContain('[data-theme="noche"] .bd-seg[data-mode="noche"]')
  })

  it('keeps the pressed mode visible in forced colors', () => {
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'))
    expect(forced).toContain('[data-theme="noche"] .bd-seg[data-mode="noche"]')
    expect(forced).toContain('background: Highlight')
  })

  it('treats the first mode as the default when the page has no data-theme', () => {
    expect(css).toContain(':root:not([data-theme]) .bd-seg[data-mode="noche"]')
    expect(css).toContain(':root:not([data-theme]) .bd-seg[data-mode]:not([data-mode="noche"])')
    expect(css).not.toContain(':root:not([data-theme]) .bd-seg[data-mode="dia"]')
  })

  it('lists every mode with three modes, the fallback following the first', () => {
    const three = buildSegmentedCss([{ id: 'a', scheme: 'dark' }, { id: 'b', scheme: 'light' }, { id: 'c', scheme: 'light' }])
    for (const id of ['a', 'b', 'c']) {
      expect(three).toContain(`[data-theme="${id}"] .bd-seg[data-mode="${id}"]`)
      expect(three).toContain(`[data-theme="${id}"] .bd-seg[data-mode]:not([data-mode="${id}"]):hover`)
    }
    expect(three).toContain(':root:not([data-theme]) .bd-seg[data-mode="a"]')
    expect(three).not.toContain(':root:not([data-theme]) .bd-seg[data-mode="b"]')
  })

  it('has no idle rules for a single mode', () => {
    expect(buildSegmentedCss([BOGOTA[1]!])).not.toContain(':not([data-mode=')
  })
})
