import { describe, expect, it } from 'vitest'
import { LIGHTNESS_STEP, atLightness, composite, contrastRatio, mixOklab, nearestPassing, nearestWhere, oklchToSrgb, parseColor, resolveRefs, srgbToOklab, srgbToOklch, toHex } from '../modules/theme/color'
import type { Rgb, Rgba } from '../modules/theme/color'

function rgb(css: string): Rgb {
  return parseColor(css) as Rgba
}

describe('parseColor', () => {
  it('reads hex in every length', () => {
    expect(toHex(rgb('#fff'))).toBe('#ffffff')
    expect(toHex(rgb('#0a0c10'))).toBe('#0a0c10')
    expect(parseColor('#ff000080')?.a).toBeCloseTo(0.5, 2)
  })

  it('lowers color-mix in oklab like Lightning CSS', () => {
    expect(toHex(rgb('color-mix(in oklab, #ff7a1a 80%, #f2f1ec)'))).toBe('#ff9557')
  })

  it('reads oklch, oklab, lab and rgba', () => {
    expect(toHex(rgb('oklch(0.7 0.15 40)'))).toBe('#eb7a52')
    expect(parseColor('oklab(0.5 0.1 0.1 / 0.5)')?.a).toBeCloseTo(0.5, 2)
    expect(toHex(rgb('lab(50 40 30)'))).toBe('#bb5846')
    expect(parseColor('rgba(46, 230, 182, 0.28)')?.a).toBeCloseTo(0.28, 2)
  })

  it('returns null for what is not a color', () => {
    expect(parseColor('not-a-color')).toBeNull()
    expect(parseColor('currentcolor')).toBeNull()
  })
})

describe('resolveRefs', () => {
  const values: Record<string, string> = { a: '{b}', b: 'var(--c)', c: '#123456', loop: '{loop}' }
  const lookup = (name: string): string | undefined => values[name]

  it('follows {name} and var(--name) chains', () => {
    expect(resolveRefs('{a}', lookup)).toBe('#123456')
    expect(resolveRefs('color-mix(in oklab, var(--c) 80%, {c})', lookup)).toBe('color-mix(in oklab, #123456 80%, #123456)')
  })

  it('returns null for unknown names and loops', () => {
    expect(resolveRefs('{missing}', lookup)).toBeNull()
    expect(resolveRefs('{loop}', lookup)).toBeNull()
  })
})

describe('contrast', () => {
  it('is 21:1 for black on white and 1:1 for equal colors', () => {
    expect(contrastRatio(rgb('#000'), rgb('#fff'))).toBeCloseTo(21, 5)
    expect(contrastRatio(rgb('#fff'), rgb('#000'))).toBeCloseTo(21, 5)
    expect(contrastRatio(rgb('#777'), rgb('#777'))).toBe(1)
  })

  it('matches a known pair (#767676 on white is 4.54:1)', () => {
    expect(contrastRatio(rgb('#767676'), rgb('#fff'))).toBeCloseTo(4.54, 2)
  })

  it('composites alpha over the surface', () => {
    const half = composite(parseColor('rgb(0 0 0 / 0.5)') as Rgba, rgb('#fff'))
    expect(toHex(half)).toBe('#808080')
    expect(composite(parseColor('#ff0000') as Rgba, rgb('#00ff00'))).toEqual({ r: 1, g: 0, b: 0 })
  })
})

describe('OKLCH', () => {
  it.each(['#ff7a1a', '#2ee6b6', '#0a0c10', '#f3e9df', '#6a4f42', '#ffffff', '#000000'])('round-trips %s', (hex) => {
    expect(toHex(oklchToSrgb(srgbToOklch(rgb(hex))))).toBe(hex)
  })

  it('puts white at L=1 and black at L=0', () => {
    expect(srgbToOklch(rgb('#fff')).l).toBeCloseTo(1, 3)
    expect(srgbToOklch(rgb('#000')).l).toBeCloseTo(0, 3)
  })
})

describe('nearestPassing', () => {
  it('returns the color itself when it already passes', () => {
    expect(nearestPassing(rgb('#000'), rgb('#fff'), 4.5)).toEqual(rgb('#000'))
  })

  it.each([
    ['#b9a99a', '#f3e9df', 4.5],
    ['#ff7a1a', '#f3e9df', 4.5],
    ['#a08a7a', '#e8d8c8', 3],
    ['#2ee6b6', '#ffffff', 4.5],
    ['#5a3a6a', '#0a0c10', 7],
  ] as const)('moves %s on %s to %s:1 and keeps the hue', (fg, bg, min) => {
    const found = nearestPassing(rgb(fg), rgb(bg), min) as Rgb
    expect(found).not.toBeNull()
    expect(contrastRatio(found, rgb(bg))).toBeGreaterThanOrEqual(min)
    const before = srgbToOklch(rgb(fg))
    const after = srgbToOklch(found)
    // Close: lightness moves by less than 0.4, hue stays
    expect(Math.abs(after.l - before.l)).toBeLessThan(0.4)
    if (before.c > 0.05) expect(Math.abs(after.h - before.h)).toBeLessThan(8)
    // One step back towards the original, with the original chroma (reduced only to stay in gamut) and hue, does not pass
    // `after` is rounded to hex, so recover the search step from the distance
    const steps = Math.round(Math.abs(after.l - before.l) / LIGHTNESS_STEP)
    const back = before.l + Math.sign(after.l - before.l) * (steps - 1) * LIGHTNESS_STEP
    const candidate = atLightness(back, before.c, before.h)
    const rounded = rgb(toHex(candidate))
    expect(contrastRatio(rounded, rgb(bg))).toBeLessThan(min)
  })

  it('returns null when no lightness reaches the ratio', () => {
    expect(nearestPassing(rgb('#808080'), rgb('#808080'), 22)).toBeNull()
  })
})

describe('nearestWhere', () => {
  it('returns the color itself when it already passes', () => {
    const fg = { r: 0, g: 0, b: 0 }
    expect(nearestWhere(fg, () => true)).toBe(fg)
  })

  it.each([
    ['#9a8a7a', '#f3e9df'],
    ['#777777', '#ffffff'],
    ['#3366cc', '#0a0c10'],
    ['#ff0000', '#ffffff'],
    // Mid-gray on mid-gray: both directions pass on the same step
    ['#808080', '#808080'],
  ])('matches nearestPassing for %s on %s', (fgHex, bgHex) => {
    const fg = parseColor(fgHex)!
    const bg = parseColor(bgHex)!
    for (const min of [3, 4.5, 7]) {
      expect(nearestWhere(fg, color => contrastRatio(color, bg) >= min, bg)).toEqual(nearestPassing(fg, bg, min))
    }
  })

  it('walks lightness until the predicate holds, keeping the hue', () => {
    const fg = parseColor('#3366cc')!
    const found = nearestWhere(fg, color => srgbToOklch(color).l >= srgbToOklch(fg).l + 0.1)!
    expect(srgbToOklch(found).l).toBeGreaterThanOrEqual(srgbToOklch(fg).l + 0.1)
    expect(Math.abs(srgbToOklch(found).h - srgbToOklch(fg).h)).toBeLessThan(5)
  })

  it('returns null when nothing passes', () => {
    expect(nearestWhere({ r: 0.5, g: 0.5, b: 0.5 }, () => false)).toBeNull()
  })
})

describe('mixOklab', () => {
  const [black, white, red] = [{ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }, { r: 1, g: 0, b: 0 }]

  it('is the first color at weight 1 and the second at weight 0', () => {
    expect(toHex(mixOklab(red, white, 1))).toBe('#ff0000')
    expect(toHex(mixOklab(red, white, 0))).toBe('#ffffff')
  })

  it('mixes lightness evenly in OKLab', () => {
    expect(srgbToOklab(mixOklab(black, white, 0.5)).l).toBeCloseTo(0.5, 2)
  })

  it.each([0.14, 0.5, 0.8])('matches Lightning CSS color-mix(in oklab) at %s', (weight) => {
    const css = rgb(`color-mix(in oklab, #8a1c1c ${weight * 100}%, #f3e9df)`)
    expect(toHex(mixOklab(rgb('#8a1c1c'), rgb('#f3e9df'), weight))).toBe(toHex(css))
  })
})
