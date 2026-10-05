import { afterEach, describe, expect, it, vi } from 'vitest'
import { useThemeMessage } from '../app/composables/useThemeMessage'

function withMessages(messages: Record<string, string>): void {
  vi.stubGlobal('useI18n', () => ({
    t: (key: string): string => messages[key] ?? key,
    te: (key: string): boolean => key in messages,
  }))
}

describe('useThemeMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the theme\'s text when it has one, even with a fallback', () => {
    withMessages({ 'theme.guide.title': 'Field guide', 'home.guide.title': 'Browse by topic' })
    expect(useThemeMessage()('guide.title', 'home.guide.title')).toBe('Field guide')
  })

  it('falls back to the core message when the theme has none', () => {
    withMessages({ 'home.guide.title': 'Browse by topic' })
    expect(useThemeMessage()('guide.title', 'home.guide.title')).toBe('Browse by topic')
  })

  it('returns an empty string when neither the theme nor a fallback key exists', () => {
    withMessages({})
    expect(useThemeMessage()('palette.names')).toBe('')
    expect(useThemeMessage()('palette.names', '')).toBe('')
  })

  it('does not read the core key as a theme key', () => {
    withMessages({ 'palette.names': 'core text' })
    expect(useThemeMessage()('palette.names')).toBe('')
  })

  it('returns the theme text for a key without a fallback', () => {
    withMessages({ 'theme.profile.alt': 'A sparrow' })
    expect(useThemeMessage()('profile.alt')).toBe('A sparrow')
  })
})
