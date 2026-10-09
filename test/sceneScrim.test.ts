import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composite, contrastRatio } from '../modules/theme/color'
import type { Rgb } from '../modules/theme/color'
import { TEXT_MIN, lookupFor, resolveOver } from '../modules/theme/contrast'
import { discoverThemes, themeRoots } from '../modules/theme/themes'

// The head of a background scene sits on a panel of the surface role over the poster, which can be any image (#246).
// Black and white posters are the extremes, so the text keeps AA over every poster when it does over those two.
const root = fileURLToPath(new URL('..', import.meta.url))
const css = readFileSync(fileURLToPath(new URL('../app/assets/css/components/section.css', import.meta.url)), 'utf8')
const rule = /\[data-section="scene"\]\[data-variant="background"\] \.myc-section-head \{[^}]*background: color-mix\(in srgb, var\(--surface\) (\d+)%, transparent\)/.exec(css)
const alpha = Number(rule?.[1]) / 100
const POSTERS: Record<string, Rgb> = { black: { r: 0, g: 0, b: 0 }, white: { r: 1, g: 1, b: 1 } }
const installed = discoverThemes(themeRoots(root, ''))
const cases = installed.flatMap(theme => theme.manifest.modes.map(mode => ({ theme, mode: mode.id })))

describe('the head of a background scene', () => {
  it('has a scrim made of the surface role', () => {
    expect(rule, 'section.css must give the head a color-mix of --surface').not.toBeNull()
    expect(alpha).toBeGreaterThan(0.5)
    expect(alpha).toBeLessThanOrEqual(1)
  })

  describe.each(cases)('$theme.id in $mode', ({ theme, mode }) => {
    const lookup = lookupFor(theme.manifest, mode)
    const surface = resolveOver(lookup, 'surface', null) as Rgb

    it.each(['ink', 'ink-muted'])('keeps %s at AA over a black and a white poster', (role) => {
      const ink = resolveOver(lookup, role, surface) as Rgb
      for (const [name, poster] of Object.entries(POSTERS)) {
        const panel = composite({ ...surface, a: alpha }, poster)
        expect(contrastRatio(ink, panel), `${role} over a ${name} poster`).toBeGreaterThanOrEqual(TEXT_MIN)
      }
    })
  })
})
