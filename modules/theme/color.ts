import { transform } from 'lightningcss'
import { parseHex } from '../../app/helpers/color'
import type { Rgba } from '../../app/helpers/color'

// Color parsing for the contrast checks (ADR 0005, section 1 and the 2026-10-06 amendment). The pure math lives in
// app/helpers/color.ts (the server uses it too); this file keeps what needs Lightning CSS, which lowers any CSS color
// (color-mix, oklch, lab…) to sRGB for old targets.

export * from '../../app/helpers/color'

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00',
  orange: '#ffa500', gray: '#808080', grey: '#808080', purple: '#800080', transparent: '#00000000',
}

/** Only the comma form: Lightning CSS lowers every rgb() it emits to it. */
function parseRgbFunction(text: string): Rgba | null {
  const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(text)
  if (!match) return null
  return { r: Number(match[1]) / 255, g: Number(match[2]) / 255, b: Number(match[3]) / 255, a: match[4] === undefined ? 1 : Number(match[4]) }
}

/** The first declaration Lightning CSS emits for `color: <value>`, lowered for browsers without modern color. */
function lowerColor(value: string): string {
  const { code } = transform({ filename: 'color.css', code: Buffer.from(`a{color:${value}}`), targets: { chrome: 50 << 16 }, minify: true })
  const match = /color:([^;}]+)/.exec(code.toString())
  return match?.[1]?.trim() ?? value
}

/** A CSS color as sRGB with alpha, or null when it is not a color Lightning CSS understands. */
export function parseColor(css: string): Rgba | null {
  const text = css.trim().toLowerCase()
  const direct = text.startsWith('#') ? parseHex(text) : null
  if (direct) return direct
  const named = NAMED[text]
  if (named) return parseHex(named)
  try {
    const lowered = lowerColor(text)
    return (lowered.startsWith('#') ? parseHex(lowered) : null) ?? parseRgbFunction(lowered) ?? (NAMED[lowered] ? parseHex(NAMED[lowered]) : null)
  } catch {
    return null
  }
}
