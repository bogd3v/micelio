// Pure color math (sRGB, WCAG 2, OKLCH). No lightningcss: the build (modules/theme/color.ts) and the server both import it.

/** sRGB channels in 0..1. */
export interface Rgb { r: number, g: number, b: number }
export interface Rgba extends Rgb { a: number }
export interface Oklch { l: number, c: number, h: number }

const MAX_REF_DEPTH = 20

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** #rgb, #rgba, #rrggbb or #rrggbbaa as sRGB with alpha; null when it is not one. */
export function parseHex(hex: string): Rgba | null {
  const body = hex.slice(1)
  if (!/^[\da-f]+$/i.test(body) || ![3, 4, 6, 8].includes(body.length)) return null
  const full = body.length <= 4 ? [...body].map(ch => ch + ch).join('') : body
  const byte = (index: number): number => Number.parseInt(full.slice(index * 2, index * 2 + 2), 16) / 255
  return { r: byte(0), g: byte(1), b: byte(2), a: full.length === 8 ? byte(3) : 1 }
}

/** Replaces `{name}` and `var(--name)` with the value `lookup` returns, until none is left. Null when a name is unknown or loops. */
export function resolveRefs(value: string, lookup: (name: string) => string | undefined): string | null {
  let current = value
  for (let depth = 0; depth < MAX_REF_DEPTH; depth++) {
    let missing = false
    let replaced = false
    const next = current.replace(/\{([\w-]+)\}|var\(\s*--([\w-]+)\s*\)/g, (_all, brace: string | undefined, variable: string | undefined) => {
      const found = lookup((brace ?? variable) as string)
      replaced = true
      if (found === undefined) missing = true
      return found ?? ''
    })
    if (missing) return null
    if (!replaced) return current
    current = next
  }
  return null
}

/** Alpha over an opaque background. */
export function composite(fg: Rgba, bg: Rgb): Rgb {
  return { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) }
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function gamma(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
}

/** WCAG 2 relative luminance. */
export function luminance(color: Rgb): number {
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b)
}

/** WCAG 2 contrast ratio, 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export function toHex(color: Rgb): string {
  return `#${[color.r, color.g, color.b].map(channel => Math.round(clamp01(channel) * 255).toString(16).padStart(2, '0')).join('')}`
}

/** sRGB to OKLCH (Ottosson); `h` in degrees. */
export function srgbToOklch(color: Rgb): Oklch {
  const [r, g, b] = [linear(color.r), linear(color.g), linear(color.b)] as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: lightness, c: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 }
}

/** OKLCH to unclamped sRGB; channels outside 0..1 mean out of gamut. */
function oklchToRawSrgb({ l: lightness, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  }
}

const EPSILON = 1e-6

function inGamut(color: Rgb): boolean {
  return [color.r, color.g, color.b].every(channel => channel >= -EPSILON && channel <= 1 + EPSILON)
}

export function oklchToSrgb(color: Oklch): Rgb {
  const raw = oklchToRawSrgb(color)
  return { r: clamp01(raw.r), g: clamp01(raw.g), b: clamp01(raw.b) }
}

/** The color at lightness `l` and hue `h`, with the most chroma up to `c` that stays in gamut. */
export function atLightness(l: number, c: number, h: number): Rgb {
  if (inGamut(oklchToRawSrgb({ l, c, h }))) return oklchToSrgb({ l, c, h })
  let [low, high] = [0, c]
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (inGamut(oklchToRawSrgb({ l, c: mid, h }))) low = mid
    else high = mid
  }
  return oklchToSrgb({ l, c: low, h })
}

export const LIGHTNESS_STEP = 0.002

/**
 * The color closest to `fg` that satisfies `passes`: lightness moves in OKLCH with hue kept and chroma
 * reduced only to stay in gamut (ADR 0005, section 8). `passes` sees the rounded sRGB value.
 * Both directions can pass on the same step: with `contrastOn` the one with more contrast on it wins, without it the darker one (it is listed first).
 * Null when no lightness passes.
 */
export function nearestWhere(fg: Rgb, passes: (candidate: Rgb) => boolean, contrastOn?: Rgb): Rgb | null {
  if (passes(fg)) return fg
  const { l, c, h } = srgbToOklch(fg)
  for (let step = 1; step * LIGHTNESS_STEP <= 1; step++) {
    const delta = step * LIGHTNESS_STEP
    const candidates = [l - delta, l + delta].filter(value => value >= 0 && value <= 1).map(value => atLightness(value, c, h))
    const passing = candidates.map(color => parseHex(toHex(color)) as Rgba).filter(color => passes(color))
    if (passing.length) {
      // Both directions can pass on the same step: more contrast on `contrastOn`, else the darker (first)
      const best = (contrastOn ? passing.sort((x, y) => contrastRatio(y, contrastOn) - contrastRatio(x, contrastOn)) : passing)[0] as Rgba
      return { r: best.r, g: best.g, b: best.b }
    }
  }
  return null
}

/** The color closest to `fg` that reaches `min` on `bg` (ADR 0005, section 8). Null when no lightness reaches it. */
export function nearestPassing(fg: Rgb, bg: Rgb, min: number): Rgb | null {
  return nearestWhere(fg, color => contrastRatio(color, bg) >= min, bg)
}
