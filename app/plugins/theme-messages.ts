import type { ThemeMessages } from '~/interfaces'

// The active theme's `theme.*` messages reach vue-i18n here, per request and not in the build (ADR 0009, section 6). The server
// sends the messages of the page's locale in the payload; a visitor who switches language gets the other locale's from the
// theme's immutable runtime.json. Slots and pages read them with `t('theme.…')` as before.
export default defineNuxtPlugin({
  name: 'theme-messages',
  dependsOn: ['i18n:plugin:route-locale-detect'],
  async setup(nuxtApp) {
    const i18n = nuxtApp.$i18n
    const loaded = useState<Record<string, ThemeMessages>>('myc-theme-messages', () => ({}))

    /**
     * Adds the theme's messages (a tree whose only top-level key is `theme`) to a locale as one new top-level object: the locale's
     * own object, which the server shares between requests, is never written to.
     */
    function apply(locale: string): void {
      const theme = loaded.value[locale]
      if (theme) i18n.setLocaleMessage(locale, { ...i18n.getLocaleMessage(locale), ...theme })
    }

    if (import.meta.server) {
      const locale = i18n.locale.value
      const theme = useRequestEvent()?.context.themeMessages?.[locale]
      if (theme) loaded.value = { [locale]: theme }
    }
    apply(i18n.locale.value)

    nuxtApp.hook('i18n:beforeLocaleSwitch', async ({ newLocale }) => {
      if (loaded.value[newLocale] || import.meta.server) return
      const { digest } = useThemeData()
      try {
        const file = await $fetch<{ messages?: Record<string, ThemeMessages> }>(`/_t/${digest}/runtime.json`)
        const theme = file.messages?.[newLocale]
        if (theme) loaded.value = { ...loaded.value, [newLocale]: theme }
      } catch {
        // The page keeps the core messages for the theme's text: te() is false, so each place shows its fallback
      }
    })
    nuxtApp.hook('i18n:localeSwitched', ({ newLocale }) => {
      apply(newLocale)
    })
  },
})
