import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrastProblems } from '../modules/theme/contrast'
import { buildPalette } from '../modules/theme/palette'
import type { ThemePalette } from '../modules/theme/palette'
import { discoverThemes } from '../modules/theme/themes'
import type { ThemeManifest } from '../modules/theme/types'
import { resetThemeLog, resolveTheme, themeOverridesCss } from '../server/utils/theme'
import type { ThemeSettings } from '../app/interfaces/site'

const root = fileURLToPath(new URL('..', import.meta.url))
const installed = discoverThemes([join(root, 'themes')])
const manifestOf = (id: string): ThemeManifest => installed.find(theme => theme.id === id)!.manifest

type TokenValue = string | Record<string, string>

/** The manifest with these color tokens replaced (or added). */
function withTokens(manifest: ThemeManifest, patch: Record<string, TokenValue>): ThemeManifest {
  const tokens = manifest.color.tokens.map(token => (token.name in patch ? { ...token, value: patch[token.name]! } : token))
  for (const [name, value] of Object.entries(patch)) {
    if (!tokens.some(token => token.name === name)) tokens.push({ name, value } as (typeof tokens)[number])
  }
  return { ...manifest, color: { ...manifest.color, tokens } }
}

const THEMES = [
  ['starter', manifestOf('starter')],
  ['starter with link and focus as the accent (link-soft is the core default)', withTokens(manifestOf('starter'), { link: '{accent}', focus: '{accent}' })],
  ['starter with link as the accent and link-soft as accent-soft', withTokens(manifestOf('starter'), { 'link': '{accent}', 'focus': '{accent}', 'link-soft': '{accent-soft}' })],
] as const

const RULE_ROLES = ['accent', 'on-accent', 'link', 'focus']
const FAMILY = ['accent', 'accent-soft', 'accent-hover', 'on-accent'] as const

function setup(manifest: ThemeManifest, settings: ThemeSettings): { palette: ThemePalette, theme: ReturnType<typeof resolveTheme>, applied: ThemeManifest } {
  const palette = buildPalette(manifest)
  const theme = resolveTheme(settings, palette, manifest.id)
  // Feed the result back as the tokens a theme would have
  const patch: Record<string, Record<string, string>> = {}
  for (const [index, role] of FAMILY.entries()) {
    const key = ['accent', 'accentSoft', 'accentHover', 'onAccent'][index] as 'accent'
    patch[role] = Object.fromEntries(manifest.modes.map(mode => [mode.id, theme?.accents[mode.id]?.[key] ?? palette.modes[mode.id]![role]]))
  }
  return { palette, theme, applied: withTokens(manifest, patch) }
}

let warn: MockInstance<typeof console.warn>
beforeEach(() => {
  resetThemeLog()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => warn.mockRestore())

/** The `message` of each structured line written to the warning log (server/utils/log.ts). */
function warned(): string[] {
  return warn.mock.calls.map(call => JSON.parse(String(call[0])).message as string)
}

describe.each(THEMES)('accent override on %s', (_name, manifest) => {
  const modes = manifest.modes.map(mode => [mode.id, mode.scheme] as const)

  it.each(modes)('a bad accent in %s (%s) is corrected so accent, on-accent, link and focus pass', (modeId, scheme) => {
    const bad = scheme === 'light' ? '#ffff00' : '#202020'
    const { theme, applied } = setup(manifest, { accentOverrides: [{ mode: modeId, color: bad }] })
    const accents = theme?.accents[modeId]
    expect(accents, 'a correctable accent is emitted').toBeDefined()
    expect(accents!.accent).not.toBe(bad)
    for (const value of Object.values(accents!)) expect(value).toMatch(/^#[\da-f]{6}$/)
    expect(contrastProblems(applied).filter(item => RULE_ROLES.includes(item.role)).map(item => item.message)).toEqual([])
    expect(warned()).toContainEqual(expect.stringContaining(`mode "${modeId}" adjusted for contrast: ${bad} -> ${accents!.accent}`))
  })

  it.each(modes)('an accent that already passes in %s (%s) is kept as is', (modeId, scheme) => {
    const good = scheme === 'light' ? '#8a1c1c' : '#ffcf5a'
    const { theme, applied } = setup(manifest, { accentOverrides: [{ mode: modeId, color: good.toUpperCase() }] })
    expect(theme?.accents[modeId]?.accent).toBe(good)
    expect(contrastProblems(applied).filter(item => RULE_ROLES.includes(item.role))).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })

  it.each(['#ffff00', '#202020', '#808080', '#00ff00', '#0000ff'])('every mode ends with passing contrast for %s', (color) => {
    const { applied } = setup(manifest, { accentOverrides: manifest.modes.map(mode => ({ mode: mode.id, color })) })
    expect(contrastProblems(applied).filter(item => RULE_ROLES.includes(item.role)).map(item => item.message)).toEqual([])
  })
})

describe('resolveTheme', () => {
  const palette = buildPalette(manifestOf('starter'))
  const resolve = (raw: ThemeSettings | null | undefined): ReturnType<typeof resolveTheme> => resolveTheme(raw, palette, 'starter')

  it('derives accent-soft, accent-hover and on-accent from the accent', () => {
    expect(resolve({ accentOverrides: [{ mode: 'light', color: '#8a1c1c' }] })).toMatchInlineSnapshot(`
      {
        "accents": {
          "light": {
            "accent": "#8a1c1c",
            "accentHover": "#77231e",
            "accentSoft": "#ead3c9",
            "onAccent": "#f6f1e7",
          },
        },
        "id": "starter",
      }
    `)
  })

  it('has nothing to say for no theme, an empty one, or a missing one', () => {
    expect(resolve(null)).toBeNull()
    expect(resolve(undefined)).toBeNull()
    expect(resolve({})).toBeNull()
    expect(resolve({ accentOverrides: [] })).toBeNull()
  })

  it('emits nothing for the theme\'s own accent, in any case', () => {
    const { dark } = palette.modes
    expect(resolve({ accentOverrides: [{ mode: 'dark', color: dark!.accent.toUpperCase() }] })).toBeNull()
  })

  it('keeps a display font only when it is a value of the enum', () => {
    expect(resolve({ displayFont: 'newsreader', defaultMode: 'light' })?.displayFont).toBe('newsreader')
    expect(resolve({ displayFont: 'toString' as never, defaultMode: 'light' })?.displayFont).toBeUndefined()
    expect(resolve({ displayFont: 'comic-sans' as never })).toBeNull()
  })

  it('applies the overrides to the active theme when Strapi names another, and says so', () => {
    const theme = resolve({ themeId: 'other', defaultMode: 'light', displayFont: 'fraunces' })
    expect(theme).toEqual({ id: 'starter', defaultMode: 'light', displayFont: 'fraunces', accents: {} })
    expect(warned()).toContainEqual(expect.stringContaining('"other" is not the active theme'))
    warn.mockClear()
    resolve({ themeId: 'starter', defaultMode: 'light' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('logs the same adjustment once', () => {
    const settings = { accentOverrides: [{ mode: 'light', color: '#ffff00' }] }
    resolve(settings)
    resolve(settings)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('keeps a defaultMode only when the theme has that mode', () => {
    expect(resolve({ defaultMode: 'dark' })?.defaultMode).toBe('dark')
    expect(resolve({ defaultMode: 'sepia' })).toBeNull()
    expect(resolve({ defaultMode: 'constructor' })).toBeNull()
  })

  it('ignores overrides for modes the theme does not have', () => {
    expect(resolve({ accentOverrides: [{ mode: 'sepia', color: '#8a1c1c' }, { mode: 'toString', color: '#8a1c1c' }] })).toBeNull()
  })

  it('keeps the theme\'s accent, and says so, when no lightness passes', () => {
    const impossible: ThemePalette = {
      ...palette,
      modes: { light: { ...palette.modes.light!, 'surface': '#000000', 'surface-raised': '#ffffff', 'surface-sunken': '#000000' } },
      rules: [{ role: 'accent', surfaces: ['surface', 'surface-raised'], min: 10 }],
    }
    expect(resolveTheme({ accentOverrides: [{ mode: 'light', color: '#8a1c1c' }] }, impossible, 'starter')).toBeNull()
    expect(warned()).toContainEqual(expect.stringContaining('reaches no contrast'))
  })
})

describe('themeOverridesCss', () => {
  const accents = { accent: '#8a1c1c', accentSoft: '#f1dfd1', accentHover: '#6f1d16', onAccent: '#ffffff' }

  it('writes one rule per mode of the manifest', () => {
    expect(themeOverridesCss({ id: 'bogota', accents: { dia: accents, noche: { ...accents, accent: '#ffcf5a' } } }, ['noche', 'dia'])).toMatchInlineSnapshot(
      `"[data-theme="noche"]{--accent:#ffcf5a;--accent-soft:#f1dfd1;--accent-hover:#6f1d16;--on-accent:#ffffff}[data-theme="dia"]{--accent:#8a1c1c;--accent-soft:#f1dfd1;--accent-hover:#6f1d16;--on-accent:#ffffff}"`,
    )
  })

  it('is null without a theme, without accents, or for modes the manifest does not have', () => {
    expect(themeOverridesCss(undefined, ['dia'])).toBeNull()
    expect(themeOverridesCss({ id: 'bogota', defaultMode: 'dia', accents: {} }, ['dia'])).toBeNull()
    expect(themeOverridesCss({ id: 'bogota', accents: { sepia: accents } }, ['dia'])).toBeNull()
  })

  it('never emits a value that is not a hex, nor a mode id that is not a slug', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(themeOverridesCss({ id: 'bogota', accents: { dia: { ...accents, accent: '</style><script>x</script>' } } }, ['dia'])).toBeNull()
    expect(themeOverridesCss({ id: 'bogota', accents: { dia: accents } }, ['dia"]{}'])).toBeNull()
    error.mockRestore()
  })
})
