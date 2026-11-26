import { logText } from './upstreamError'
import { logError, logWarn } from './log'
import { contrastRatio, mixOklab, nearestWhere, parseHex, toHex } from '~/helpers/color'
import type { Rgb } from '~/helpers/color'
import type { AccentColors, SiteTheme, ThemeSettings } from '~/interfaces/site'
import { displayFontId } from './displayFonts'
import type { ContrastRule, ModePalette } from '../../modules/theme/types'

// Pure: the theme Strapi asks for, checked against the built theme (ADR 0005, section 8). Nothing here reads a request.

/** The slice of `#micelio/theme-palette` the resolution needs. */
interface PaletteInput {
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

function logOnce(raw: string): void {
  // The message holds values from the CMS: one line, whatever they contain
  const message = logText(raw)
  if (logged.has(message)) return
  if (logged.size >= MAX_LOGGED) logged.clear()
  logged.add(message)
  logWarn('theme.adjusted', message)
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

/** The roles an accent moves in a mode: its family and, when the theme defines them as the accent, link, focus and link-soft. */
function followers(derived: Derived, mode: ModePalette): Record<string, Rgb> {
  const moved: Record<string, Rgb> = { ...derived }
  if (mode.focusIsAccent) moved.focus = derived.accent
  if (!mode.linkIsAccent) return moved
  moved.link = derived.accent
  if (mode.linkSoftIsAccentSoft) moved['link-soft'] = derived['accent-soft']
  // The core default, color-mix(in srgb, var(--link) 12%, var(--surface))
  else if (mode.linkSoftIsDefault) moved['link-soft'] = rgb(toHex(mixSrgb(derived.accent, rgb(mode.surface), LINK_SOFT_SHARE)))
  return moved
}

/**
 * The colors of the roles an override's accent family moves in one mode, as `#rrggbb`: `accent`, `accent-soft`, `accent-hover`, `on-accent`, and `link`, `focus` and `link-soft` when the theme defines them from the accent.
 *
 * @remarks
 * The roles `resolveTheme` checks the override against (ADR 0005, section 8); any other role keeps the theme's value.
 */
export function accentRoleColors(accents: AccentColors, mode: ModePalette): Record<string, string> {
  const derived: Derived = { 'accent': rgb(accents.accent), 'accent-soft': rgb(accents.accentSoft), 'accent-hover': rgb(accents.accentHover), 'on-accent': rgb(accents.onAccent) }
  return Object.fromEntries(Object.entries(followers(derived, mode)).map(([role, color]) => [role, toHex(color)]))
}

/** Whether `accent` keeps every rule the accent can break: itself, its family and, when the theme defines them as the accent, link and focus. */
function passes(accent: Rgb, mode: ModePalette, rules: ContrastRule[]): boolean {
  const derived = derive(accent, mode)
  const moved = followers(derived, mode)
  const colorOf = (role: string): Rgb | undefined => {
    if (Object.hasOwn(moved, role)) return moved[role]
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

/** The accent family for `color` in `mode`: the color itself when it passes, the nearest lightness that does, or null when none does. A candidate (`log` false) is not logged. */
function resolveAccent(color: string, modeId: string, mode: ModePalette, rules: ContrastRule[], log: boolean): AccentColors | null {
  const wanted = parseHex(color)
  if (!wanted) return null
  const found = nearestWhere(wanted, candidate => passes(candidate, mode, rules), rgb(mode.surface))
  if (!found) {
    if (log) logOnce(`Theme accent override ${color} for mode "${modeId}" reaches no contrast; the theme's accent stays`)
    return null
  }
  const result = accentColors(derive(found, mode))
  if (log && result.accent !== color.toLowerCase()) {
    logOnce(`Theme accent override for mode "${modeId}" adjusted for contrast: ${color.toLowerCase()} -> ${result.accent}`)
  }
  return result
}

/**
 * The part of `site-setting.theme` that applies to the active theme, or null when nothing does.
 *
 * @remarks
 * `buildTheme` is the id of the active theme. A `themeId` that names another theme is not acted on here (the switch activates it, or
 * reports why not, ADR 0009): the overrides go to the active theme meanwhile. A `defaultMode` and overrides for modes the theme does not have
 * are ignored, and so is an accent equal to the theme's own. A failing accent is moved in OKLCH lightness until it passes.
 *
 * An accent moved or kept is logged once as `theme.adjusted`, because it says a saved setting renders otherwise. `options.candidate` says the settings are
 * an editor's unsaved candidates (a preview token's accents, the query of `GET /_micelio/contrast`): they are resolved the same way and logged never.
 */
export function resolveTheme(raw: ThemeSettings | null | undefined, palette: PaletteInput, buildTheme: string, options: { candidate?: boolean } = {}): SiteTheme | null {
  if (!raw) return null
  if (raw.themeId && raw.themeId !== buildTheme) {
    logOnce(`Strapi's theme "${raw.themeId}" is not the active theme "${buildTheme}" (yet, or it could not be activated); its overrides apply to the active one`)
  }
  const theme: SiteTheme = { id: buildTheme, accents: {} }
  if (raw.defaultMode && Object.hasOwn(palette.modes, raw.defaultMode)) theme.defaultMode = raw.defaultMode
  const displayFont = displayFontId(raw.displayFont)
  if (displayFont) theme.displayFont = displayFont
  for (const { mode: modeId, color } of raw.accentOverrides ?? []) {
    const mode = Object.hasOwn(palette.modes, modeId) ? palette.modes[modeId] : undefined
    if (!mode || color.toLowerCase() === mode.accent) continue
    const accents = resolveAccent(color, modeId, mode, palette.rules, !options.candidate)
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
    logError('theme.overrides', 'Theme overrides left out: the CSS does not match the expected shape')
    return null
  }
  return css
}

/**
 * The site's theme overrides with the accents a preview grant carries in place of the saved ones (ADR 0019, amendment of 2026-11-25).
 *
 * @remarks
 * The candidates are resolved as the saved ones are, against the palette of the theme the draft renders: a mode the theme lacks is ignored and a failing
 * accent is moved until it passes, without the `theme.adjusted` log of a saved setting. The saved default mode and display font stay.
 */
export function withPreviewAccents(saved: SiteTheme | undefined, accentOverrides: Array<{ mode: string, color: string }>, palette: PaletteInput, themeId: string): SiteTheme {
  const accents = resolveTheme({ accentOverrides }, palette, themeId, { candidate: true })?.accents ?? {}
  return { ...saved, id: themeId, accents }
}
