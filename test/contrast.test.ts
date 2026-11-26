import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTRAST_RULES } from '../modules/theme/constants'
import { contrastPairs } from '../app/helpers/contrast'
import { colorsOf, contrastProblems, contrastRulesFor, lookupFor } from '../modules/theme/contrast'
import { buildContrastTable, buildPalette } from '../modules/theme/palette'
import { discoverThemes } from '../modules/theme/themes'
import type { ThemeManifest } from '../modules/theme/types'
import { contrastReport } from '../server/utils/contrastReport'
import { resetThemeLog, resolveTheme } from '../server/utils/theme'

// The contrast matrix moved to app/helpers/contrast.ts and its rules to modules/theme/constants.ts (bogd3v/micelio#737) without changing what it holds: test/fixtures/contrast/main-problems.json is
// what `contrastProblems` answered on main (7e806bb4) for every installed theme and for low-contrast with values that reach each branch of the matrix.
const root = fileURLToPath(new URL('..', import.meta.url))
const onMain = JSON.parse(readFileSync(join(root, 'test/fixtures/contrast/main-problems.json'), 'utf8')) as Record<string, unknown[]>
const ROOTS = ['themes', '.micelio/themes', 'test/fixtures/themes', 'test/fixtures/themes/alternates']

/** low-contrast with one value changed per case, as the fixture was made. */
function variants(base: ThemeManifest): Array<[string, ThemeManifest]> {
  const make = (name: string, edit: (manifest: ThemeManifest) => void): [string, ThemeManifest] => {
    const manifest = structuredClone(base)
    edit(manifest)
    return [name, manifest]
  }
  const set = (manifest: ThemeManifest, name: string, value: string): void => {
    manifest.color.tokens.find(token => token.name === name)!.value = value
  }
  return [
    make('translucent-ink', manifest => set(manifest, 'ink-muted', 'rgba(43, 26, 19, 0.45)')),
    make('oklch-accent', manifest => set(manifest, 'accent', 'oklch(0.72 0.12 60)')),
    make('unresolvable-link', manifest => set(manifest, 'link', 'not-a-color')),
    make('translucent-surface', manifest => set(manifest, 'surface', 'rgba(243, 233, 223, 0.5)')),
    make('unknown-on', (manifest) => {
      manifest.color.tokens.find(token => token.name === 'ink')!.contrast = [{ on: 'nowhere', min: 3 }]
    }),
    make('contract-2.1', (manifest) => {
      manifest.contract = '2.1'
    }),
  ]
}

const cases: Array<[string, ThemeManifest]> = ROOTS.flatMap(dir => discoverThemes([join(root, dir)]).map(theme => [`${dir}/${theme.id}`, theme.manifest] as [string, ThemeManifest]))
const [lowContrast] = discoverThemes([join(root, 'test/fixtures/themes/low-contrast')])
cases.push(...variants(lowContrast!.manifest).map(([name, manifest]) => [`low-contrast+${name}`, manifest] as [string, ThemeManifest]))

describe('the contrast matrix', () => {
  it('gives every installed theme and mode the same failures as contrastProblems did on main', () => {
    // bogota is pulled (`npm run theme:pull`), so a checkout without it compares the rest
    const compared = cases.filter(([key]) => key in onMain)
    expect(compared.map(([key]) => key)).toEqual(Object.keys(onMain).filter(key => key !== '.micelio/themes/bogota' || cases.some(([name]) => name === key)))
    expect(compared.length).toBeGreaterThanOrEqual(12)
    for (const [key, manifest] of compared) expect(contrastProblems(manifest), key).toEqual(onMain[key])
    // The fixture holds failures of every kind: a ratio, a translucent foreground, a value that is not a color, a surface with nothing under it
    expect(Object.values(onMain).flat().length).toBeGreaterThan(40)
  })

  it('measures every pair of the rules, with the failures of contrastProblems among them', () => {
    const [, manifest] = cases.find(([key]) => key === 'low-contrast+oklch-accent')!
    const rules = contrastRulesFor(manifest)
    const pairs = contrastPairs(rules, colorsOf(lookupFor(manifest, 'day')))
    expect(pairs).toHaveLength(rules.reduce((sum, rule) => sum + rule.surfaces.length, 0))
    expect(pairs.filter(pair => !pair.passes).map(({ role, surface, ratio, min, suggestion }) => ({ role, surface, ratio, min, suggestion })))
      .toEqual(contrastProblems(manifest).map(({ role, surface, ratio, min, suggestion }) => ({ role, surface, ratio, min, suggestion })))
    expect(pairs.find(pair => pair.role === 'ink' && pair.surface === 'surface')).toMatchObject({ passes: true, suggestion: null })
  })

  it('holds a theme to the rules of its contract and to the ones its tokens declare', () => {
    const manifest = lowContrast!.manifest
    expect(contrastRulesFor(manifest)).toContainEqual({ role: 'line-strong', surfaces: ['surface-sunken'], min: 4 })
    expect(contrastRulesFor(manifest).some(rule => rule.surfaces.includes('accent-soft') && rule.role === 'ink')).toBe(false)
    expect(contrastRulesFor({ ...manifest, contract: '2.1' }).filter(rule => 'since' in rule)).toEqual([])
    expect(contrastRulesFor({ ...manifest, contract: '2.1' }).length).toBe(CONTRAST_RULES.length + 1)
  })
})

describe('contrastReport', () => {
  const [starter] = discoverThemes([join(root, 'themes')])
  const manifest = starter!.manifest
  const runtime = { id: manifest.id, modes: manifest.modes, palette: buildPalette(manifest), contrast: buildContrastTable(manifest) }

  it('answers the pairs of theme:check for the theme as it is', () => {
    const report = contrastReport(runtime, [])
    expect(report.theme).toBe('starter')
    for (const mode of report.modes) {
      expect(mode.accent).toBeNull()
      expect(mode.pairs).toEqual(contrastPairs(contrastRulesFor(manifest), colorsOf(lookupFor(manifest, mode.mode))).map(({ role, surface, ratio, min, passes }) => ({ role, surface, ratio, min, passes })))
    }
  })

  it('measures a candidate as the resolved family that would render, and ignores a mode the theme lacks', () => {
    const candidates = [{ mode: 'light', color: '#8a1c1c' }, { mode: 'sepia', color: '#123456' }]
    const report = contrastReport(runtime, candidates)
    const light = report.modes.find(mode => mode.mode === 'light')!
    expect(light.accent).toEqual(resolveTheme({ accentOverrides: candidates }, runtime.palette, 'starter')!.accents.light)
    expect(light.pairs.find(pair => pair.role === 'accent' && pair.surface === 'surface')!.ratio).not.toBe(contrastReport(runtime, []).modes[0]!.pairs.find(pair => pair.role === 'accent' && pair.surface === 'surface')!.ratio)
    expect(report.modes.find(mode => mode.mode === 'dark')!.accent).toBeNull()
    expect(report.modes.map(mode => mode.mode)).toEqual(['light', 'dark'])
  })

  it('measures a candidate without the theme.adjusted log of a saved setting', () => {
    resetThemeLog()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(contrastReport(runtime, [{ mode: 'light', color: '#ffff00' }]).modes[0]!.accent!.accent).not.toBe('#ffff00')
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('reads a role with no color as a pair it cannot measure', () => {
    const table = structuredClone(runtime.contrast)
    table.modes.light!['ink-muted'] = null
    const pairs = contrastReport({ ...runtime, contrast: table }, []).modes[0]!.pairs.filter(pair => pair.role === 'ink-muted')
    expect(pairs.length).toBeGreaterThan(0)
    for (const pair of pairs) expect(pair).toMatchObject({ ratio: null, passes: false })
  })
})
