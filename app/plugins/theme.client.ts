import { modes } from '#micelio/theme'
import { isThemeMode, migrateStoredMode, readStoredMode, systemMode } from '~/helpers/theme'

export default defineNuxtPlugin((nuxtApp) => {
  const { sync } = useTheme()

  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
    migrateStoredMode(modes)
    const current = document.documentElement.getAttribute('data-theme')
    sync(isThemeMode(modes, current) ? current : systemMode(modes))

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (!readStoredMode(modes)) sync(systemMode(modes))
    })
  })
})
