import { describe, expect, it } from 'vitest'
import { cardStyleOf } from '../server/lib/cardStyle'
import type { BuiltInTheme } from '../server/lib/types'

// What the social card takes from the theme and the site settings (bogd3v/micelio#734): the choice of mode, accent and font, with no I/O

const DAY = { surface: '#f6f1e7', ink: '#1d1a16', accent: '#2f6f4f' }
const NIGHT = { surface: '#101418', ink: '#eef1f4', accent: '#7ac7a1' }
const SANS = new Uint8Array([1])
const DISPLAY = new Uint8Array([2])

/** A theme with the parts the choice reads; `display` and `fonts` are the ones to vary. */
function themeOf(parts: { display?: string, fonts?: string[], files?: Record<string, Uint8Array> } = {}): Pick<BuiltInTheme, 'entry' | 'runtime'> {
  const files = new Map(Object.entries(parts.files ?? { 'fonts/sans.woff2': SANS, 'fonts/display.woff2': DISPLAY }))
  return {
    entry: { files },
    runtime: {
      digest: 'digest-a',
      modes: [{ id: 'day' }, { id: 'night' }],
      palette: { modes: { day: DAY, night: NIGHT } },
      display: { family: 'Display', ...(parts.display ? { file: parts.display } : {}) },
      fonts: (parts.fonts ?? ['sans.woff2']).map(file => ({ family: 'Sans', file })),
    },
  } as unknown as Pick<BuiltInTheme, 'entry' | 'runtime'>
}

const site = (theme?: { defaultMode?: string, accents: Record<string, { accent: string }> }, themeDigest = 'digest-a') => ({ themeDigest, site: { name: 'Example', ...(theme ? { theme } : {}) } })

describe('cardStyleOf', () => {
  it('takes the first mode of the theme, its colours and the site name', () => {
    expect(cardStyleOf(themeOf({ display: 'display.woff2' }), site(), 'Title')).toEqual({ title: 'Title', siteName: 'Example', ...DAY, fontFile: DISPLAY })
  })

  it('takes the mode the site settings name, and the accent they override for it', () => {
    const style = cardStyleOf(themeOf({ display: 'display.woff2' }), site({ defaultMode: 'night', accents: { night: { accent: '#ff8800' }, day: { accent: '#00ff88' } } }), 'Title')
    expect(style).toMatchObject({ surface: NIGHT.surface, ink: NIGHT.ink, accent: '#ff8800' })
  })

  it('ignores a mode the theme does not have, and overrides for the mode that is not drawn', () => {
    const style = cardStyleOf(themeOf({ display: 'display.woff2' }), site({ defaultMode: 'dusk', accents: { night: { accent: '#ff8800' } } }), 'Title')
    expect(style).toMatchObject({ surface: DAY.surface, accent: DAY.accent })
  })

  it('leaves out the overrides resolved against another theme', () => {
    const style = cardStyleOf(themeOf({ display: 'display.woff2' }), site({ defaultMode: 'night', accents: { night: { accent: '#ff8800' } } }, 'digest-b'), 'Title')
    expect(style).toMatchObject({ surface: DAY.surface, accent: DAY.accent })
  })

  it('draws with the first declared font when the theme names no display font', () => {
    expect(cardStyleOf(themeOf(), site(), 'Title')!.fontFile).toBe(SANS)
  })

  it('answers null for a theme that declares no font, or whose font file is not among its files', () => {
    expect(cardStyleOf(themeOf({ fonts: [], files: {} }), site(), 'Title')).toBeNull()
    expect(cardStyleOf(themeOf({ display: 'display.woff2', files: { 'fonts/sans.woff2': SANS } }), site(), 'Title')).toBeNull()
  })
})
