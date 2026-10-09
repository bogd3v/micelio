import { contrastRatio, mixOklab, nearestWhere, parseHex, toHex } from '~/helpers/color'
import type { Rgb } from '~/helpers/color'
import type { AccentColors, SiteTheme, ThemeSettings } from '~/interfaces/site'
import { displayFontId } from './displayFonts'
import type { ContrastRule } from '../../modules/theme/types'
import type { ModePalette } from '../../modules/theme/palette'

// Pure: the theme Strapi asks for, checked against the built theme (ADR 0005, section 8). Nothing here reads a request.

/** The slice of `#micelio/theme-palette` the resolution needs. */
export interface PaletteInput {
  modes: Record<string, ModePalette>
  rules: ContrastRule[]
}

/** Share of the accent in `accent-soft` (mixed into `surface`) and in `accent-hover` (mixed with `ink`). */
const SOFT_SHARE = 0.14
const HOVER_SHARE = 0.8
const LINK_SOFT_SHARE = 0.12

function mixSrgb(a: Rgb, b: Rgb, weight: number): Rgb {
  return { r: a.r * weight + b.r * (1 - weight), g: a.g * weight + b.g * (1 - weight), b: a.b * weight + b.b * (1 - weight) }
}

// /api/site resolves on every request, so each distinct message is logged once per process
const logged = new Set<string>()
const MAX_LOGGED = 100

function logOnce(message: string): void {
  if (logged.has(message)) return
  if (logged.size >= MAX_LOGGED) logged.clear()
  logged.add(message)
  console.warn(message)
}

/** For tests: forget what was logged. */
export function resetThemeLog(): void {
  logged.clear()
}

type Derived = Record<'accent' | 'accent-soft' | 'accent-hover' | 'on-accent', Rgb>

function rgb(hex: string): Rgb {
  return parseHex(hex) as Rgb
}

/** The family derived from an accent, each value rounded to the hex that will be emitted. */
function derive(accent: Rgb, mode: ModePalette): Derived {
  const rounded = (color: Rgb): Rgb => rgb(toHex(color))
  const base = rounded(accent)
  const [ink, onInk] = [rgb(mode.ink), rgb(mode['on-ink'])]
  const hover = rounded(mixOklab(base, ink, HOVER_SHARE))
  return {
    'accent': base,
    'accent-soft': rounded(mixOklab(base, rgb(mode.surface), SOFT_SHARE)),
    'accent-hover': hover,
    'on-accent': contrastRatio(ink, base) >= contrastRatio(onInk, base) ? ink : onInk,
  }
}

/** Whether `accent` keeps every rule the accent can break: itself, its family and, when the theme defines them as the accent, link and focus. */
function passes(accent: Rgb, mode: ModePalette, rules: ContrastRule[]): boolean {
  const derived = derive(accent, mode)
  const colorOf = (role: string): Rgb | undefined => {
    if (role in derived) return derived[role as keyof Derived]
    if (role === 'link' && mode.linkIsAccent) return derived.accent
    if (role === 'focus' && mode.focusIsAccent) return derived.accent
    if (role === 'link-soft' && mode.linkIsAccent) {
      if (mode.linkSoftIsAccentSoft) return derived['accent-soft']
      // The core default, color-mix(in srgb, var(--link) 12%, var(--surface))
      if (mode.linkSoftIsDefault) return rgb(toHex(mixSrgb(derived.accent, rgb(mode.surface), LINK_SOFT_SHARE)))
    }
    const value = (mode as unknown as Record<string, unknown>)[role]
    return typeof value === 'string' && value.startsWith('#') ? rgb(value) : undefined
  }
  return rules.every((rule) => {
    const follows = rule.role in derived || (rule.role === 'link' && mode.linkIsAccent) || (rule.role === 'focus' && mode.focusIsAccent)
    if (!follows) return true
    const fg = colorOf(rule.role) as Rgb
    return rule.surfaces.every((surface) => {
      const bg = colorOf(surface)
      return !bg || contrastRatio(fg, bg) >= rule.min
    })
  })
}

function accentColors(derived: Derived): AccentColors {
  return {
    accent: toHex(derived.accent),
    accentSoft: toHex(derived['accent-soft']),
    accentHover: toHex(derived['accent-hover']),
    onAccent: toHex(derived['on-accent']),
  }
}

/** The accent family for `color` in `mode`: the color itself when it passes, the nearest lightness that does, or null when none does. */
function resolveAccent(color: string, modeId: string, mode: ModePalette, rules: ContrastRule[]): AccentColors | null {
  const wanted = parseHex(color)
  if (!wanted) return null
  const found = nearestWhere(wanted, candidate => passes(candidate, mode, rules), rgb(mode.surface))
  if (!found) {
    logOnce(`Theme accent override ${color} for mode "${modeId}" reaches no contrast; the theme's accent stays`)
    return null
  }
  const result = accentColors(derive(found, mode))
  if (result.accent !== color.toLowerCase()) {
    logOnce(`Theme accent override for mode "${modeId}" adjusted for contrast: ${color.toLowerCase()} -> ${result.accent}`)
  }
  return result
}

/**
 * The part of `site-setting.theme` that applies to the built theme, or null when nothing does.
 * Another `themeId` is ignored (a build has one theme), as are a `defaultMode` and overrides for modes it does not have,
 * and an accent equal to the theme's own. A failing accent is moved in OKLCH lightness until it passes.
 */
export function resolveTheme(raw: ThemeSettings | null | undefined, palette: PaletteInput, buildTheme: string): SiteTheme | null {
  if (!raw) return null
  if (raw.themeId && raw.themeId !== buildTheme) {
    logOnce(`Strapi's theme "${raw.themeId}" is not installed; this build has "${buildTheme}"`)
  }
  const theme: SiteTheme = { id: buildTheme, accents: {} }
  if (raw.defaultMode && Object.hasOwn(palette.modes, raw.defaultMode)) theme.defaultMode = raw.defaultMode
  const displayFont = displayFontId(raw.displayFont)
  if (displayFont) theme.displayFont = displayFont
  for (const { mode: modeId, color } of raw.accentOverrides ?? []) {
    const mode = Object.hasOwn(palette.modes, modeId) ? palette.modes[modeId] : undefined
    if (!mode || color.toLowerCase() === mode.accent) continue
    const accents = resolveAccent(color, modeId, mode, palette.rules)
    if (accents && accents.accent !== mode.accent) theme.accents[modeId] = accents
  }
  return theme.defaultMode || theme.displayFont || Object.keys(theme.accents).length ? theme : null
}

const OVERRIDE_RULE = /^(?:\[data-theme="[a-z][a-z0-9-]*"\]\{--accent:#[\da-f]{6};--accent-soft:#[\da-f]{6};--accent-hover:#[\da-f]{6};--on-accent:#[\da-f]{6}\})+$/

/**
 * The CSS of `<style id="theme-overrides">`, or null when there is none. Mode ids come from `modeIds` (the built manifest),
 * matched by equality, and every value from toHex(): nothing from Strapi is interpolated. The result is checked against a whitelist.
 */
export function themeOverridesCss(theme: SiteTheme | undefined, modeIds: string[]): string | null {
  if (!theme) return null
  const css = modeIds.flatMap((id) => {
    const accents = Object.hasOwn(theme.accents, id) ? theme.accents[id] : undefined
    return accents
      ? [`[data-theme="${id}"]{--accent:${accents.accent};--accent-soft:${accents.accentSoft};--accent-hover:${accents.accentHover};--on-accent:${accents.onAccent}}`]
      : []
  }).join('')
  if (!css) return null
  if (!OVERRIDE_RULE.test(css)) {
    console.error('Theme overrides left out: the CSS does not match the expected shape')
    return null
  }
  return css
}
