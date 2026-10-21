import { describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { compileMessages } from '../../modules/theme/install/messages'
import { BOGOTA_THEME_DATA } from './themeData'

// A locale the app does not list, so the frozen messages stay out of the ones the other tests use (the types only know en and es)
const XX = 'xx' as 'es'

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) for (const child of Object.values(value)) freeze(child)
  return Object.freeze(value)
}

const loaded = (): Record<string, unknown> => useNuxtApp().payload.state['$smyc-theme-messages'] as Record<string, unknown>

describe('the theme messages plugin', () => {
  it('adds the theme to a locale as a new object, formats a frozen message, and leaves the locale\'s own object alone', async () => {
    const { $i18n } = useNuxtApp()
    // A made-up locale keeps the frozen messages out of the ones the other tests use; its own object stands for the one the server shares
    const shared = freeze(compileMessages({ nav: { home: 'Inicio' } }))
    $i18n.setLocaleMessage(XX, shared)
    const theme = freeze(compileMessages({ theme: { probe: { greeting: 'Hola {name}' } } }))
    useNuxtApp().payload.state['$smyc-theme-messages'] = { [XX]: theme }
    await useNuxtApp().callHook('i18n:localeSwitched', { newLocale: XX, oldLocale: 'en' })
    const after = $i18n.getLocaleMessage(XX)
    expect(after).not.toBe(shared)
    expect(shared).not.toHaveProperty('theme')
    expect($i18n.te('theme.probe.greeting', XX)).toBe(true)
    expect($i18n.t('theme.probe.greeting', { name: 'Ana' }, { locale: XX })).toBe('Hola Ana')
    // The rest of the locale is still there
    expect($i18n.te('nav.home', XX)).toBe(true)
  })

  it('fetches the messages of the other locale from the theme\'s immutable file, once', async () => {
    let requests = 0
    registerEndpoint(`/_t/${BOGOTA_THEME_DATA.digest}/runtime.json`, () => {
      requests++
      return { messages: { es: compileMessages({ theme: { fetched: { text: 'Traído' } } }) } }
    })
    useNuxtApp().payload.state['$smyc-theme-messages'] = {}
    await useNuxtApp().callHook('i18n:beforeLocaleSwitch', { newLocale: 'es', oldLocale: 'en', initialSetup: false, context: useNuxtApp() })
    expect(Object.keys(loaded())).toEqual(['es'])
    await useNuxtApp().callHook('i18n:beforeLocaleSwitch', { newLocale: 'es', oldLocale: 'en', initialSetup: false, context: useNuxtApp() })
    expect(requests).toBe(1)
  })

  it('keeps the page working, with the core fallbacks, when the file cannot be fetched', async () => {
    registerEndpoint(`/_t/${BOGOTA_THEME_DATA.digest}/runtime.json`, () => {
      throw createError({ statusCode: 500 })
    })
    useNuxtApp().payload.state['$smyc-theme-messages'] = {}
    await expect(useNuxtApp().callHook('i18n:beforeLocaleSwitch', { newLocale: 'es', oldLocale: 'en', initialSetup: false, context: useNuxtApp() })).resolves.not.toThrow()
    expect(loaded()).toEqual({})
  })
})
