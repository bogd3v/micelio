import { contrastPairs } from '../../app/helpers/contrast'
import type { ColorOf, ContrastPair } from '../../app/helpers/contrast'
import { composite, parseColor, resolveRefs } from './color'
import type { Rgb } from './color'
import { CONTRAST_RULES } from './constants'
import { OPTIONAL_ROLES } from './roles.mjs'
import { parseContractVersion } from './version'
import type { ContrastRule, ThemeManifest } from './types'

// The contrast check of `theme:check` (ADR 0005, section 1 and its 2026-10-06 amendment), per mode: this file resolves a theme's values to colors
// with Lightning CSS, and the matrix itself is the pure `contrastPairs` of app/helpers/contrast.ts on the rules of `CONTRAST_RULES` (constants.ts), which the server measures too.

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

/** The colors of one mode, with their alpha, as `contrastPairs` reads them: a role with no value, or one that is not a color, gives the reason. */
export function colorsOf(lookup: Lookup): ColorOf {
  return (name) => {
    const raw = lookup(name)
    if (raw === undefined) return `"${name}" has no value`
    const resolved = resolveRefs(raw, lookup)
    return (resolved === null ? null : parseColor(resolved)) ?? `"${name}" is "${raw}", which is not a color this check can resolve`
  }
}

/** The opaque color of a role in a mode over `backdrop`; a string is the reason when it cannot be resolved. */
export function resolveOver(lookup: Lookup, name: string, backdrop: Rgb | null): Resolved | string {
  const color = colorsOf(lookup)(name)
  if (typeof color === 'string') return color
  if (color.a < 1 && !backdrop) return `"${name}" is translucent and has no surface under it`
  return backdrop ? { ...composite(color, backdrop), translucent: color.a < 1 } : { r: color.r, g: color.g, b: color.b }
}

function message(theme: string, mode: string, pair: ContrastPair): string {
  const { role, surface, min, ratio, suggestion, reason } = pair
  if (ratio === null) return `theme "${theme}", mode "${mode}": cannot check "${role}" on "${surface}": ${reason}`
  return `theme "${theme}", mode "${mode}": "${role}" on "${surface}" has ${ratio.toFixed(2)}:1, needs ${min}:1${suggestion ? `; nearest passing value ${suggestion}` : '; no lightness passes'}`
}

/** The rule table that applies to a theme's contract, plus the `contrast` its tokens declare. Optional roles count with the core default when omitted. */
export function contrastRulesFor(manifest: ThemeManifest): ContrastRule[] {
  const contract = parseContractVersion(manifest.contract)
  const applies = (rule: ContrastRule): boolean => {
    const since = parseContractVersion(rule.since ?? '0.0')!
    return !!contract && (contract.major > since.major || (contract.major === since.major && contract.minor >= since.minor))
  }
  const declared = manifest.color.tokens.flatMap(token => (token.contrast ?? []).map(extra => ({ role: token.name, surfaces: [extra.on], min: extra.min })))
  return CONTRAST_RULES.filter(applies).map(({ since: _since, ...rule }) => rule).concat(declared)
}

/** Every contrast failure of a theme with a valid contract, in every mode. */
export function contrastProblems(manifest: ThemeManifest): ContrastProblem[] {
  const rules = contrastRulesFor(manifest)
  return manifest.modes.flatMap(mode => contrastPairs(rules, colorsOf(lookupFor(manifest, mode.id)))
    .filter(pair => !pair.passes)
    .map(pair => ({ theme: manifest.id, mode: mode.id, role: pair.role, surface: pair.surface, ratio: pair.ratio, min: pair.min, suggestion: pair.suggestion, message: message(manifest.id, mode.id, pair) })))
}
