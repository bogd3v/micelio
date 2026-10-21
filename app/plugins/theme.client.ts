import { isThemeMode, readStoredMode, systemMode } from '~/helpers/theme'

export default defineNuxtPlugin((nuxtApp) => {
  const { sync } = useTheme()
  const { modes } = useThemeData()

  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
    const current = document.documentElement.getAttribute('data-theme')
    sync(isThemeMode(modes, current) ? current : systemMode(modes))

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (!readStoredMode(modes)) sync(systemMode(modes))
    })
  })
})
