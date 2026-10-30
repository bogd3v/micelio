import { describe, expect, it } from 'vitest'
import { STARTER_THEME_DATA, setThemeData } from './themeData'

describe('useThemeData', () => {
  it('returns what the server put in the payload', () => {
    expect(useThemeData()).toEqual(STARTER_THEME_DATA)
    setThemeData({ id: 'other' })
    expect(useThemeData().id).toBe('other')
  })

  it('fails loudly, not with a blank page, when the server did not provide it', () => {
    useNuxtApp().payload.state['$smyc-theme-data'] = undefined
    expect(() => useThemeData()).toThrow('The active theme is not loaded')
  })
})
