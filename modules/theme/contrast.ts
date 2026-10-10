import { composite, contrastRatio, nearestPassing, parseColor, resolveRefs, toHex } from './color'
import type { Rgb } from './color'
import { OPTIONAL_ROLES } from './roles.mjs'
import type { ContrastRule, ThemeManifest } from './types'

// Contrast rules of ADR 0005, section 1 (WCAG 2 AA) and its 2026-10-06 amendment, evaluated per mode.

/**
 * Minimum contrast ratio of text (WCAG 2 AA).
 *
 * @internal Exported for tests.
 */
export const TEXT_MIN = 4.5
const CONTROL_MIN = 3

const SURFACES = ['surface', 'surface-raised', 'surface-sunken']
const STATES = ['success', 'warning', 'danger', 'info']
const CATEGORIES = [1, 2, 3, 4, 5].map(n => `category-${n}`)

/** Text roles: on the three surfaces and on their own `-soft` (when it exists). */
const SOFT_TEXT = ['accent', 'link', ...STATES, ...CATEGORIES]

/**
 * The contrast every installed theme must meet in every mode (ADR 0005, section 1 and its 2026-10-06 amendment).
 *
 * @remarks
 * Text meets `TEXT_MIN` (4.5:1): `ink` and `ink-muted` on the three surfaces; the `code-*` roles on `surface-sunken`; `on-ink` on `ink`; `on-accent` on `accent`
 * and `accent-hover`; `accent`, `link`, the states and the categories on the three surfaces and on their own `-soft` role.
 * `line-strong` and `focus` meet 3:1 on the surfaces. An optional role the theme omits is checked with its core default. `contrastProblems`
 * adds the `contrast` assertions that a theme declares on its tokens.
 */
export const CONTRAST_RULES: ContrastRule[] = [
  ...['ink', 'ink-muted'].map(role => ({ role, surfaces: SURFACES, min: TEXT_MIN })),
  ...SOFT_TEXT.map(role => ({ role, surfaces: [...SURFACES, `${role}-soft`], min: TEXT_MIN })),
  { role: 'on-ink', surfaces: ['ink'], min: TEXT_MIN },
  { role: 'on-accent', surfaces: ['accent', 'accent-hover'], min: TEXT_MIN },
  ...['line-strong', 'focus'].map(role => ({ role, surfaces: SURFACES, min: CONTROL_MIN })),
  ...['code-ink', 'code-muted', 'code-keyword', 'code-string', 'code-number', 'code-function'].map(role => ({ role, surfaces: ['surface-sunken'], min: TEXT_MIN })),
]

interface ContrastProblem {
  theme: string
  mode: string
  role: string
  surface: string
  /** Measured ratio, floored to two decimals; null when a value is not a color. */
  ratio: number | null
  min: number
  /** The nearest value of `role` that passes, as hex; null when none does or the value is not a color. */
  suggestion: string | null
  message: string
}

/** Reads the raw value of a role or token in one mode, before its `{name}` references are resolved; `undefined` when there is none. */
export type Lookup = (name: string) => string | undefined

/**
 * Reads the values of one mode of a theme, from its color and shadow tokens.
 *
 * @remarks
 * A token with one value per mode gives its value for `mode`, and a single value applies in every mode. A role the theme omits
 * gives its core default, when it has one (`OPTIONAL_ROLES`).
 *
 * @param manifest - The theme's `theme.json`, already valid.
 * @param mode - Id of one of the theme's modes.
 */
export function lookupFor(manifest: ThemeManifest, mode: string): Lookup {
  const tokens = new Map<string, string | Record<string, string>>()
  for (const token of [...manifest.color.tokens, ...(manifest.shadow?.tokens ?? [])]) tokens.set(token.name, token.value)
  return (name) => {
    const value = tokens.get(name)
    if (value === undefined) return (OPTIONAL_ROLES.color as Record<string, string>)[name]
    return typeof value === 'object' ? value[mode] : value
  }
}

type Resolved = Rgb & { translucent?: boolean }

/** The opaque color of a role in a mode over `backdrop`; a string is the reason when it cannot be resolved. */
export function resolveOver(lookup: Lookup, name: string, backdrop: Rgb | null): Resolved | string {
  const raw = lookup(name)
  if (raw === undefined) return `"${name}" has no value`
  const resolved = resolveRefs(raw, lookup)
  const color = resolved === null ? null : parseColor(resolved)
  if (!color) return `"${name}" is "${raw}", which is not a color this check can resolve`
  if (color.a < 1 && !backdrop) return `"${name}" is translucent and has no surface under it`
  return backdrop ? { ...composite(color, backdrop), translucent: color.a < 1 } : { r: color.r, g: color.g, b: color.b }
}

function problem(theme: string, mode: string, role: string, surface: string, min: number, fg: Resolved | string, bg: Rgb | string): ContrastProblem | null {
  if (typeof fg === 'string' || typeof bg === 'string') {
    const reason = typeof fg === 'string' ? fg : bg as string
    return { theme, mode, role, surface, ratio: null, min, suggestion: null, message: `theme "${theme}", mode "${mode}": cannot check "${role}" on "${surface}": ${reason}` }
  }
  const raw = contrastRatio(fg, bg)
  if (raw >= min) return null
  const ratio = Math.floor(raw * 100) / 100
  // A translucent foreground would lose its alpha in a hex, valid over one surface only
  const nearest = fg.translucent ? null : nearestPassing(fg, bg, min)
  const suggestion = nearest ? toHex(nearest) : null
  return {
    theme, mode, role, surface, ratio, min, suggestion,
    message: `theme "${theme}", mode "${mode}": "${role}" on "${surface}" has ${ratio.toFixed(2)}:1, needs ${min}:1${suggestion ? `; nearest passing value ${suggestion}` : '; no lightness passes'}`,
  }
}

/** The rule table plus the `contrast` the tokens declare. Optional roles count with the core default when omitted. */
function rulesFor(manifest: ThemeManifest): ContrastRule[] {
  const declared = manifest.color.tokens.flatMap(token => (token.contrast ?? []).map(extra => ({ role: token.name, surfaces: [extra.on], min: extra.min })))
  return [...CONTRAST_RULES, ...declared]
}

/** Every contrast failure of a theme with a valid contract, in every mode. */
export function contrastProblems(manifest: ThemeManifest): ContrastProblem[] {
  const problems: ContrastProblem[] = []
  const rules = rulesFor(manifest)
  for (const mode of manifest.modes) {
    const lookup = lookupFor(manifest, mode.id)
    const base = resolveOver(lookup, 'surface', null)
    const cache = new Map<string, Resolved | string>()
    // Opaque color of a role; translucent values sit on `surface` when no other backdrop is known
    const opaque = (name: string, backdrop: Rgb | null): Resolved | string => {
      const key = `${name}|${backdrop ? toHex(backdrop) : ''}`
      if (!cache.has(key)) cache.set(key, resolveOver(lookup, name, backdrop ?? (typeof base === 'string' ? null : base)))
      return cache.get(key) as Resolved | string
    }
    for (const rule of rules) {
      for (const surface of rule.surfaces) {
        const bg = opaque(surface, null)
        const fg = opaque(rule.role, typeof bg === 'string' ? null : bg)
        const found = problem(manifest.id, mode.id, rule.role, surface, rule.min, fg, bg)
        if (found) problems.push(found)
      }
    }
  }
  return problems
}
