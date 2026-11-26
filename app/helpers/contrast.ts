import { composite, contrastRatio, nearestPassing, toHex } from './color'
import type { ContrastRule, Rgb, Rgba } from '../../modules/theme/types'

// The contrast matrix of ADR 0005, section 1 (WCAG 2 AA) and its 2026-10-06 amendment (the rules: `CONTRAST_RULES` of modules/theme/constants.ts), on colors
// already resolved. No Lightning CSS: `theme:check` (modules/theme/contrast.ts, which resolves a theme's values) and the server (GET /_micelio/contrast) both call it.

/** One pair of the matrix in one mode: a foreground role on a surface. */
export interface ContrastPair {
  role: string
  surface: string
  min: number
  /** The measured ratio, floored to two decimals; `null` when a value is not a color, has none, or is translucent with nothing under it. */
  ratio: number | null
  /** Whether the unrounded ratio reaches `min`; `false` when `ratio` is `null`. */
  passes: boolean
  /** For a failing pair, the nearest value of `role` that passes, as hex; `null` when none does, the foreground is translucent, or `ratio` is `null`. */
  suggestion: string | null
  /** Why the pair could not be measured, when `ratio` is `null`. */
  reason?: string
}

/** The color of a role in one mode, with its alpha, or the reason it has none. */
export type ColorOf = (role: string) => Rgba | string

type Resolved = Rgb & { translucent?: boolean }

/** A role's opaque color over `backdrop`; a translucent one with no backdrop is a reason. */
function over(colorOf: ColorOf, name: string, backdrop: Rgb | null): Resolved | string {
  const color = colorOf(name)
  if (typeof color === 'string') return color
  if (color.a < 1 && !backdrop) return `"${name}" is translucent and has no surface under it`
  return backdrop ? { ...composite(color, backdrop), translucent: color.a < 1 } : { r: color.r, g: color.g, b: color.b }
}

/**
 * Every pair of `rules` in one mode, in rule order, with its ratio and result.
 *
 * @remarks
 * A translucent surface sits on `surface`, and a translucent foreground on the surface of its pair, as the browser paints them. A translucent foreground
 * gets no suggestion: a hex would lose its alpha and hold over one surface only.
 */
export function contrastPairs(rules: ContrastRule[], colorOf: ColorOf): ContrastPair[] {
  const base = over(colorOf, 'surface', null)
  const cache = new Map<string, Resolved | string>()
  const opaque = (name: string, backdrop: Rgb | null): Resolved | string => {
    const key = `${name}|${backdrop ? toHex(backdrop) : ''}`
    if (!cache.has(key)) cache.set(key, over(colorOf, name, backdrop ?? (typeof base === 'string' ? null : base)))
    return cache.get(key) as Resolved | string
  }
  return rules.flatMap(rule => rule.surfaces.map((surface): ContrastPair => {
    const bg = opaque(surface, null)
    const fg = opaque(rule.role, typeof bg === 'string' ? null : bg)
    const { role, min } = rule
    if (typeof fg === 'string' || typeof bg === 'string') return { role, surface, min, ratio: null, passes: false, suggestion: null, reason: typeof fg === 'string' ? fg : bg as string }
    const raw = contrastRatio(fg, bg)
    const ratio = Math.floor(raw * 100) / 100
    if (raw >= min) return { role, surface, min, ratio, passes: true, suggestion: null }
    const nearest = fg.translucent ? null : nearestPassing(fg, bg, min)
    return { role, surface, min, ratio, passes: false, suggestion: nearest ? toHex(nearest) : null }
  }))
}
