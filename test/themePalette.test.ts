import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { CONTRAST_RULES } from '../modules/theme/contrast'
import { buildPalette } from '../modules/theme/palette'
import { discoverThemes, themeRoots } from '../modules/theme/themes'

const root = fileURLToPath(new URL('..', import.meta.url))
const installed = discoverThemes(themeRoots(root, ''))
const palette = (id: string): ReturnType<typeof buildPalette> => buildPalette(installed.find(theme => theme.id === id)!.manifest)

const HEX = /^#[\da-f]{6}$/

describe('buildPalette', () => {
  it('builds Bogotá with its two modes', () => {
    const { modes } = palette('bogota')
    expect(Object.keys(modes)).toEqual(['noche', 'dia'])
    expect(modes.noche!.scheme).toBe('dark')
    expect(modes.dia!.scheme).toBe('light')
    expect(modes.noche!.surface).toBe('#0a0c10')
    expect(modes.dia!['surface-raised']).toBe('#fbf6f0')
    expect(modes.dia!.ink).toBe('#2b1a13')
  })

  it('builds the starter with its modes', () => {
    const manifest = installed.find(theme => theme.id === 'starter')!.manifest
    expect(Object.keys(palette('starter').modes)).toEqual(manifest.modes.map(mode => mode.id))
  })

  it.each(['bogota', 'starter'])('resolves every color of %s to opaque hex', (id) => {
    for (const mode of Object.values(palette(id).modes)) {
      for (const [key, value] of Object.entries(mode)) {
        if (typeof value === 'string' && key !== 'scheme') expect(value, key).toMatch(HEX)
      }
    }
  })

  it('resolves accent-hover through color-mix', () => {
    const { noche } = palette('bogota').modes
    expect(noche!['accent-hover']).toMatch(HEX)
    expect(noche!['accent-hover']).not.toBe(noche!.accent)
  })

  it('flags link and focus only when the theme defines them as the accent', () => {
    const { noche } = palette('bogota').modes
    // Bogotá's link and focus are chillon, not the accent
    expect(noche!.linkIsAccent).toBe(false)
    expect(noche!.focusIsAccent).toBe(false)
  })

  it('detects a theme whose link is the accent', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'bogota')!.manifest)
    for (const token of manifest.color.tokens) {
      if (token.name === 'link') token.value = '{accent}'
      if (token.name === 'focus') token.value = 'var(--accent)'
    }
    const { noche } = buildPalette(manifest).modes
    expect(noche!.linkIsAccent).toBe(true)
    expect(noche!.focusIsAccent).toBe(true)
  })

  it('flags link-soft as accent-soft or as the core default', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'bogota')!.manifest)
    expect(buildPalette(manifest).modes.noche).toMatchObject({ linkSoftIsAccentSoft: false, linkSoftIsDefault: false })
    for (const token of manifest.color.tokens) {
      if (token.name === 'link-soft') token.value = '{accent-soft}'
    }
    expect(buildPalette(manifest).modes.noche).toMatchObject({ linkSoftIsAccentSoft: true, linkSoftIsDefault: false })
    manifest.color.tokens = manifest.color.tokens.filter(token => token.name !== 'link-soft')
    expect(buildPalette(manifest).modes.noche).toMatchObject({ linkSoftIsAccentSoft: false, linkSoftIsDefault: true })
  })

  it('takes the accent rules from CONTRAST_RULES', () => {
    const { rules } = palette('bogota')
    expect(rules.map(rule => rule.role).sort()).toEqual(['accent', 'focus', 'link', 'on-accent'])
    for (const rule of rules) expect(CONTRAST_RULES).toContainEqual(rule)
  })

  it('follows alias chains to the accent', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'bogota')!.manifest)
    manifest.color.tokens.push({ name: 'brand', value: '{accent}' }, { name: 'brand2', value: 'var(--brand)' })
    for (const token of manifest.color.tokens) {
      if (token.name === 'link') token.value = '{brand2}'
    }
    const { noche } = buildPalette(manifest).modes
    expect(noche!.linkIsAccent).toBe(true)
    expect(noche!.focusIsAccent).toBe(false)
  })

  it('survives an alias cycle', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'bogota')!.manifest)
    manifest.color.tokens.push({ name: 'loop-a', value: '{loop-b}' }, { name: 'loop-b', value: '{loop-a}' })
    for (const token of manifest.color.tokens) {
      if (token.name === 'focus') token.value = '{loop-a}'
    }
    expect(buildPalette(manifest).modes.noche!.focusIsAccent).toBe(false)
  })

  it('resolves link-soft over the surface', () => {
    expect(palette('bogota').modes.dia!['link-soft']).toMatch(HEX)
  })

  it('skips a mode whose role is not a color and keeps the others', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'bogota')!.manifest)
    const accent = manifest.color.tokens.find(token => token.name === 'accent')!
    accent.value = { noche: 'not-a-color', dia: '#aa3300' }
    const result = buildPalette(manifest)
    expect(Object.keys(result.modes)).toEqual(['dia'])
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]!.mode).toBe('noche')
    expect(result.skipped[0]!.reason).toMatch(/accent/)
  })
})
