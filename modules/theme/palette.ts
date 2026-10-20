import { toHex } from './color'
import { CONTRAST_RULES, lookupFor, resolveOver } from './contrast'
import type { Lookup } from './contrast'
import type { ContrastRule, ModePalette, ThemeManifest } from './types'

// The slice of the active theme the server needs to compute accent contrast at runtime (#micelio/theme-palette, Nitro only).

/** Roles whose contrast the accent override can change. */
const PALETTE_RULE_ROLES: string[] = ['accent', 'on-accent', 'link', 'focus']

interface SkippedMode {
  mode: string
  reason: string
}

/**
 * What `buildPalette` returns: the palette of every mode of a theme.
 *
 * @internal Exported for tests.
 */
export interface ThemePalette {
  /** Modes that resolved; a mode that did not is in `skipped`. */
  modes: Record<string, ModePalette>
  rules: ContrastRule[]
  skipped: SkippedMode[]
}

const COLOR_ROLES = ['surface', 'surface-raised', 'surface-sunken', 'ink', 'on-ink', 'accent', 'accent-soft', 'accent-hover', 'on-accent', 'link-soft'] as const

const MAX_ALIAS_DEPTH = 20

/** True when `role` is `target` or a chain of pure single references that ends at it. */
function isRefTo(lookup: Lookup, role: string, target: string): boolean {
  let raw = lookup(role)
  for (let depth = 0; depth < MAX_ALIAS_DEPTH && raw !== undefined; depth++) {
    const match = /^\s*(?:\{([\w-]+)\}|var\(\s*--([\w-]+)\s*\))\s*$/.exec(raw)
    const name = match?.[1] ?? match?.[2]
    if (!name) return false
    if (name === target) return true
    raw = lookup(name)
  }
  return false
}

/** Builds the palette of every mode of a theme with a valid contract. A mode that cannot be resolved is skipped, not thrown. */
export function buildPalette(manifest: ThemeManifest): ThemePalette {
  const modes: Record<string, ModePalette> = {}
  const skipped: SkippedMode[] = []
  for (const mode of manifest.modes) {
    const lookup = lookupFor(manifest, mode.id)
    const base = resolveOver(lookup, 'surface', null)
    if (typeof base === 'string') {
      skipped.push({ mode: mode.id, reason: base })
      continue
    }
    const colors = {} as Record<typeof COLOR_ROLES[number], string>
    let failure: string | null = null
    for (const role of COLOR_ROLES) {
      const color = resolveOver(lookup, role, role === 'surface' ? null : base)
      if (typeof color === 'string') {
        failure = color
        break
      }
      colors[role] = toHex(color)
    }
    if (failure) {
      skipped.push({ mode: mode.id, reason: failure })
      continue
    }
    modes[mode.id] = {
      scheme: mode.scheme,
      ...colors,
      linkIsAccent: isRefTo(lookup, 'link', 'accent'),
      focusIsAccent: isRefTo(lookup, 'focus', 'accent'),
      linkSoftIsAccentSoft: isRefTo(lookup, 'link-soft', 'accent-soft'),
      linkSoftIsDefault: !manifest.color.tokens.some(token => token.name === 'link-soft'),
    }
  }
  return { modes, rules: CONTRAST_RULES.filter(rule => PALETTE_RULE_ROLES.includes(rule.role)), skipped }
}
