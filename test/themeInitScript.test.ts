import { describe, it, expect } from 'vitest'
import { runInNewContext } from 'node:vm'
import { buildInitScript } from '../modules/theme/init-script.mjs'
import { formatModeList, isThemeMode, modeForScheme, nextMode, schemeOf, systemMode } from '~/helpers/theme'
import type { ThemeModeDefinition } from '~/interfaces'

interface Env {
  stored?: Record<string, string>
  prefersLight?: boolean
  storageThrows?: boolean
  modeDefault?: string
  serverTheme?: string
}

const BOGOTA: ThemeModeDefinition[] = [{ id: 'noche', scheme: 'dark' }, { id: 'dia', scheme: 'light' }]
const LIGHT_FIRST: ThemeModeDefinition[] = [{ id: 'paper', scheme: 'light' }, { id: 'ink', scheme: 'dark' }]
const THREE: ThemeModeDefinition[] = [{ id: 'dusk', scheme: 'dark' }, { id: 'sand', scheme: 'light' }, { id: 'dawn', scheme: 'light' }]

function run(modes: ThemeModeDefinition[], { stored = {}, prefersLight = false, storageThrows = false, modeDefault, serverTheme }: Env = {}): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (serverTheme) attrs['data-theme'] = serverTheme
  const writes: string[] = []
  const localStorage = {
    getItem(key: string): string | null {
      if (storageThrows) throw new Error('blocked')
      return stored[key] ?? null
    },
    setItem(key: string) { writes.push(key) },
    removeItem(key: string) { writes.push(key) },
  }
  runInNewContext(buildInitScript(modes), {
    localStorage,
    matchMedia: (query: string) => ({ matches: query.includes('light') && prefersLight }),
    document: {
      documentElement: {
        setAttribute: (k: string, v: string) => { attrs[k] = v },
        getAttribute: (k: string) => (k === 'data-mode-default' ? (modeDefault ?? null) : (attrs[k] ?? null)),
      },
    },
  })
  expect(writes).toEqual([])
  return attrs
}

describe('buildInitScript with the Bogota modes', () => {
  it('uses the stored mode', () => {
    expect(run(BOGOTA, { stored: { 'micelio-theme': 'dia' } })).toEqual({ 'data-theme': 'dia', 'data-scheme': 'light' })
    expect(run(BOGOTA, { stored: { 'micelio-theme': 'noche' }, prefersLight: true })).toEqual({ 'data-theme': 'noche', 'data-scheme': 'dark' })
  })

  it('reads bd-theme behind micelio-theme and ahead of the devbog keys', () => {
    expect(run(BOGOTA, { stored: { 'bd-theme': 'dia' } })).toEqual({ 'data-theme': 'dia', 'data-scheme': 'light' })
    expect(run(BOGOTA, { stored: { 'micelio-theme': 'noche', 'bd-theme': 'dia' } })['data-theme']).toBe('noche')
    expect(run(BOGOTA, { stored: { 'bd-theme': 'dia', 'devbog-theme': 'noche' } })['data-theme']).toBe('dia')
    expect(run(BOGOTA, { stored: { 'bd-theme': 'sepia', 'devbog-theme': 'dia' } })['data-theme']).toBe('dia')
  })

  it('reads the previous theme key', () => {
    expect(run(BOGOTA, { stored: { 'devbog-theme': 'dia' } })['data-theme']).toBe('dia')
    expect(run(BOGOTA, { stored: { 'micelio-theme': 'noche', 'devbog-theme': 'dia' } })['data-theme']).toBe('noche')
  })

  it('maps the legacy color mode through the scheme', () => {
    expect(run(BOGOTA, { stored: { 'devbog-color-mode': 'light' } })['data-theme']).toBe('dia')
    expect(run(BOGOTA, { stored: { 'devbog-color-mode': 'dark' }, prefersLight: true })['data-theme']).toBe('noche')
  })

  it('follows the system preference without a stored mode', () => {
    expect(run(BOGOTA, { prefersLight: true })).toEqual({ 'data-theme': 'dia', 'data-scheme': 'light' })
    expect(run(BOGOTA, { prefersLight: false })).toEqual({ 'data-theme': 'noche', 'data-scheme': 'dark' })
    expect(run(BOGOTA, { stored: { 'devbog-color-mode': 'system' }, prefersLight: true })['data-theme']).toBe('dia')
  })

  it('keeps an invalid stored value and falls through, never writing storage', () => {
    expect(run(BOGOTA, { stored: { 'micelio-theme': 'sepia' } })['data-theme']).toBe('noche')
    expect(run(BOGOTA, { stored: { 'micelio-theme': 'sepia' }, prefersLight: true })['data-theme']).toBe('dia')
  })

  it('falls back to the first mode when storage is blocked', () => {
    expect(run(BOGOTA, { storageThrows: true, prefersLight: true })['data-theme']).toBe('noche')
  })

  it('does not take the server-written data-theme for a choice', () => {
    expect(run(BOGOTA, { serverTheme: 'noche', prefersLight: true })['data-theme']).toBe('dia')
  })

  it('uses the server default mode after the stored choice and before the system preference', () => {
    expect(run(BOGOTA, { modeDefault: 'dia', prefersLight: false })['data-theme']).toBe('dia')
    expect(run(BOGOTA, { modeDefault: 'dia', stored: { 'micelio-theme': 'noche' } })['data-theme']).toBe('noche')
    expect(run(BOGOTA, { modeDefault: 'other', prefersLight: true })['data-theme']).toBe('dia')
  })
})

describe('buildInitScript with other modes', () => {
  it('works with a single mode', () => {
    const one: ThemeModeDefinition[] = [{ id: 'paper', scheme: 'light' }]
    expect(run(one, { prefersLight: false })).toEqual({ 'data-theme': 'paper', 'data-scheme': 'light' })
    expect(run(one, { stored: { 'micelio-theme': 'noche' } })['data-theme']).toBe('paper')
    expect(run(one, { stored: { 'devbog-color-mode': 'dark' } })['data-theme']).toBe('paper')
  })

  it('works with three modes, matching the first mode of the scheme', () => {
    expect(run(THREE, { prefersLight: true })['data-theme']).toBe('sand')
    expect(run(THREE, { prefersLight: false })['data-theme']).toBe('dusk')
    expect(run(THREE, { stored: { 'micelio-theme': 'dawn' } })).toEqual({ 'data-theme': 'dawn', 'data-scheme': 'light' })
    expect(run(THREE, { stored: { 'devbog-color-mode': 'light' } })['data-theme']).toBe('sand')
  })

  it('works light-first: the first mode is the fallback, the system preference still wins', () => {
    expect(run(LIGHT_FIRST, { storageThrows: true, prefersLight: false })).toEqual({ 'data-theme': 'paper', 'data-scheme': 'light' })
    expect(run(LIGHT_FIRST, { prefersLight: false })).toEqual({ 'data-theme': 'ink', 'data-scheme': 'dark' })
    expect(run(LIGHT_FIRST, { prefersLight: true })).toEqual({ 'data-theme': 'paper', 'data-scheme': 'light' })
  })

  it('uses the first mode when the theme has no mode of the preferred scheme', () => {
    const dark: ThemeModeDefinition[] = [{ id: 'a', scheme: 'dark' }, { id: 'b', scheme: 'dark' }]
    expect(run(dark, { prefersLight: true })['data-theme']).toBe('a')
    expect(run(dark, { stored: { 'devbog-color-mode': 'light' }, prefersLight: true })['data-theme']).toBe('a')
  })

  it('is byte-identical for the same modes and small for six', () => {
    expect(buildInitScript(BOGOTA)).toBe(buildInitScript(BOGOTA.map(mode => ({ ...mode }))))
    expect(buildInitScript(BOGOTA)).not.toBe(buildInitScript(LIGHT_FIRST))
    const six = Array.from({ length: 6 }, (_, i): ThemeModeDefinition => ({ id: `long-mode-name-${i}`, scheme: i % 2 ? 'light' : 'dark' }))
    expect(Buffer.byteLength(buildInitScript(six))).toBeLessThan(2048)
  })
})

describe('mode helpers', () => {
  it('knows the modes, schemes and the next mode', () => {
    expect(isThemeMode(BOGOTA, 'dia')).toBe(true)
    expect(isThemeMode(BOGOTA, 'dark')).toBe(false)
    expect(isThemeMode(BOGOTA, null)).toBe(false)
    expect(modeForScheme(THREE, 'light')).toBe('sand')
    expect(modeForScheme(BOGOTA, null)).toBeNull()
    expect(schemeOf(THREE, 'dawn')).toBe('light')
    expect(schemeOf(THREE, 'unknown')).toBe('dark')
    expect(nextMode(THREE, 'dusk')).toBe('sand')
    expect(nextMode(THREE, 'dawn')).toBe('dusk')
    expect(nextMode([{ id: 'only', scheme: 'dark' }], 'only')).toBe('only')
  })

  it('picks the system mode by scheme', () => {
    const win = (light: boolean) => ({ matchMedia: () => ({ matches: light }) })
    const original = globalThis.window
    try {
      globalThis.window = win(true) as unknown as Window & typeof globalThis
      expect(systemMode(LIGHT_FIRST)).toBe('paper')
      expect(systemMode([{ id: 'a', scheme: 'dark' }])).toBe('a')
      globalThis.window = win(false) as unknown as Window & typeof globalThis
      expect(systemMode(THREE)).toBe('dusk')
    } finally {
      globalThis.window = original
    }
  })

  it('lists the mode names in the locale', () => {
    expect(formatModeList(['Night', 'Day'], 'en')).toBe('Night or Day')
    expect(formatModeList(['Noche', 'Día'], 'es')).toBe('Noche o Día')
    expect(formatModeList(['Night'], 'en')).toBe('Night')
  })
})
