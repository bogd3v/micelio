import type { SocialCardStyle } from './socialCard'
import type { BuiltInTheme } from './types'

// What the social card (bogd3v/micelio#734) takes from the theme the server renders and from the site's settings: the choice, with no I/O, so it is unit-tested apart from the route.

/** The part of a loaded site the card reads: the name, the overrides the settings resolved and the theme they were resolved against. */
interface CardSite {
  themeDigest: string
  site: { name: string, theme?: { defaultMode?: string, accents: Record<string, { accent: string } | undefined> } }
}

/**
 * The style of the card of `title` on `theme` and the site's settings, or `null` when the theme ships no font file to draw with.
 *
 * @remarks
 * The mode is the one the settings name (`defaultMode`) when the theme has it, else the theme's first; the accent is the settings' override for that mode when there is one. The overrides count
 * only when they were resolved against this theme (`themeDigest`): another one's modes do not have them. The font is the theme's display font, else its first declared font; the site's curated
 * display font (`site.theme.displayFont`) is not used, since the card is the theme's own (`docs/api.md`, "Social card of a draft"). The family to draw with is one of the file's own making (`renderSocialCard`).
 */
export function cardStyleOf(theme: Pick<BuiltInTheme, 'entry' | 'runtime'>, loaded: CardSite, title: string): SocialCardStyle | null {
  const { entry, runtime } = theme
  const overrides = loaded.themeDigest === runtime.digest ? loaded.site.theme : undefined
  const modeId = overrides?.defaultMode && runtime.palette.modes[overrides.defaultMode] ? overrides.defaultMode : runtime.modes[0]?.id
  const mode = modeId ? runtime.palette.modes[modeId] : undefined
  const fontFile = runtime.display.file ?? runtime.fonts[0]?.file
  const font = fontFile ? entry.files.get(`fonts/${fontFile}`) : undefined
  if (!mode || !font) return null
  return {
    title,
    siteName: loaded.site.name,
    surface: mode.surface,
    ink: mode.ink,
    accent: (modeId && overrides?.accents[modeId]?.accent) || mode.accent,
    fontFile: font,
  }
}
