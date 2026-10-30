import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTRAST_RULES } from '../modules/theme/contrast'
import { buildPalette } from '../modules/theme/palette'
import { discoverThemes } from '../modules/theme/themes'

const root = fileURLToPath(new URL('..', import.meta.url))
const installed = discoverThemes([join(root, 'themes')])
const palette = (id: string): ReturnType<typeof buildPalette> => buildPalette(installed.find(theme => theme.id === id)!.manifest)

const HEX = /^#[\da-f]{6}$/

describe('buildPalette', () => {
  it('builds the starter with its two modes', () => {
    const { modes } = palette('starter')
    expect(Object.keys(modes)).toEqual(['light', 'dark'])
    expect(Object.keys(modes)).toEqual(installed.find(theme => theme.id === 'starter')!.manifest.modes.map(mode => mode.id))
    expect(modes.light!.scheme).toBe('light')
    expect(modes.dark!.scheme).toBe('dark')
    expect(modes.light!.surface).toBe('#f6f1e7')
    expect(modes.light!['surface-raised']).toBe('#fffdf8')
    expect(modes.light!.ink).toBe('#2a2620')
  })

  it.each(['starter'])('resolves every color of %s to opaque hex', (id) => {
    for (const mode of Object.values(palette(id).modes)) {
      for (const [key, value] of Object.entries(mode)) {
        if (typeof value === 'string' && key !== 'scheme') expect(value, key).toMatch(HEX)
      }
    }
  })

  it('resolves accent-hover through color-mix', () => {
    const { light } = palette('starter').modes
    expect(light!['accent-hover']).toMatch(HEX)
    expect(light!['accent-hover']).not.toBe(light!.accent)
  })

  it('flags link and focus only when the theme defines them as the accent', () => {
    const { light } = palette('starter').modes
    // The starter's link and focus are sage, not the accent
    expect(light!.linkIsAccent).toBe(false)
    expect(light!.focusIsAccent).toBe(false)
  })

  it('detects a theme whose link is the accent', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'starter')!.manifest)
    for (const token of manifest.color.tokens) {
      if (token.name === 'link') token.value = '{accent}'
      if (token.name === 'focus') token.value = 'var(--accent)'
    }
    const { light } = buildPalette(manifest).modes
    expect(light!.linkIsAccent).toBe(true)
    expect(light!.focusIsAccent).toBe(true)
  })

  it('flags link-soft as accent-soft or as the core default', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'starter')!.manifest)
    // The starter leaves link-soft to the core
    expect(buildPalette(manifest).modes.light).toMatchObject({ linkSoftIsAccentSoft: false, linkSoftIsDefault: true })
    manifest.color.tokens.push({ name: 'link-soft', value: '#c9d8cc' })
    expect(buildPalette(manifest).modes.light).toMatchObject({ linkSoftIsAccentSoft: false, linkSoftIsDefault: false })
    for (const token of manifest.color.tokens) {
      if (token.name === 'link-soft') token.value = '{accent-soft}'
    }
    expect(buildPalette(manifest).modes.light).toMatchObject({ linkSoftIsAccentSoft: true, linkSoftIsDefault: false })
    manifest.color.tokens = manifest.color.tokens.filter(token => token.name !== 'link-soft')
    expect(buildPalette(manifest).modes.light).toMatchObject({ linkSoftIsAccentSoft: false, linkSoftIsDefault: true })
  })

  it('takes the accent rules from CONTRAST_RULES', () => {
    const { rules } = palette('starter')
    expect(rules.map(rule => rule.role).sort()).toEqual(['accent', 'focus', 'link', 'on-accent'])
    for (const rule of rules) expect(CONTRAST_RULES).toContainEqual(rule)
  })

  it('follows alias chains to the accent', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'starter')!.manifest)
    manifest.color.tokens.push({ name: 'brand', value: '{accent}' }, { name: 'brand2', value: 'var(--brand)' })
    for (const token of manifest.color.tokens) {
      if (token.name === 'link') token.value = '{brand2}'
    }
    const { light } = buildPalette(manifest).modes
    expect(light!.linkIsAccent).toBe(true)
    expect(light!.focusIsAccent).toBe(false)
  })

  it('survives an alias cycle', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'starter')!.manifest)
    manifest.color.tokens.push({ name: 'loop-a', value: '{loop-b}' }, { name: 'loop-b', value: '{loop-a}' })
    for (const token of manifest.color.tokens) {
      if (token.name === 'focus') token.value = '{loop-a}'
    }
    expect(buildPalette(manifest).modes.light!.focusIsAccent).toBe(false)
  })

  it('resolves link-soft over the surface', () => {
    expect(palette('starter').modes.light!['link-soft']).toMatch(HEX)
  })

  it('skips a mode whose role is not a color and keeps the others', () => {
    const manifest = structuredClone(installed.find(theme => theme.id === 'starter')!.manifest)
    const accent = manifest.color.tokens.find(token => token.name === 'accent')!
    accent.value = { light: 'not-a-color', dark: '#aa3300' }
    const result = buildPalette(manifest)
    expect(Object.keys(result.modes)).toEqual(['dark'])
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]!.mode).toBe('light')
    expect(result.skipped[0]!.reason).toMatch(/accent/)
  })
})
