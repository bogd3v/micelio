import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useThemeHud } from '../app/composables/useThemeHud'

function withMessages(messages: Record<string, string>): void {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useI18n', () => ({
    t: (key: string): string => messages[key] ?? key,
    te: (key: string): boolean => key in messages,
  }))
}

describe('useThemeHud', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is empty when the theme has no theme.hud messages', () => {
    withMessages({ 'nav.home': 'Home' })
    expect(useThemeHud().value).toEqual({})
  })

  it('returns only the fields the theme provides', () => {
    withMessages({ 'theme.hud.city': 'Bogotá', 'theme.hud.altitude': '2,640 m' })
    expect(useThemeHud().value).toEqual({ city: 'Bogotá', altitude: '2,640 m' })
  })

  it('returns every field, and ignores keys outside theme.hud', () => {
    withMessages({
      'theme.hud.city': 'A',
      'theme.hud.coords': 'B',
      'theme.hud.altitude': 'C',
      'theme.hud.madeIn': 'D',
      'theme.hud.other': 'E',
      'myc.header.hud.city': 'F',
    })
    expect(useThemeHud().value).toEqual({ city: 'A', coords: 'B', altitude: 'C', madeIn: 'D' })
  })
})
