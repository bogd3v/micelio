import { fileURLToPath } from 'node:url'
import { ENTRY_FILES } from '../../modules/theme/install/constants'
import { dir } from '#micelio/built-in-store'
import { loadDefaultTheme, locateBuiltInStore, watchBuiltInIndex } from '../lib/builtInStore'
import type { BuiltInTheme } from '../lib/types'
import { themeDataOf, themeMessagesOf } from '../lib/themeData'
import { setActiveTheme } from '../utils/activeTheme'

// Loads and verifies the instance's default theme (NUXT_PUBLIC_THEME, else the build's) from the built-in store at boot; a defect stops the boot (ADR 0009, section 6).
// Plugins run in file order and this one sorts before themeMode.ts, which reads the theme in its hooks.
export default defineNitroPlugin((nitroApp) => {
  const configured = useRuntimeConfig().public.theme
  const storeDir = locateBuiltInStore([process.argv[1] ?? '', fileURLToPath(import.meta.url)], dir)
  let data: ReturnType<typeof themeDataOf>
  let messages: ReturnType<typeof themeMessagesOf>
  function use(theme: BuiltInTheme): void {
    setActiveTheme(theme)
    data = themeDataOf(theme.runtime, theme.entry.files.has(ENTRY_FILES.sections))
    messages = themeMessagesOf(theme.runtime)
  }
  use(loadDefaultTheme(storeDir, configured))
  // Development only: the build installs an edited theme again, and the next request sees it
  const refresh = import.meta.dev ? watchBuiltInIndex(storeDir, () => loadDefaultTheme(storeDir, configured), use, error => logError('theme.reload', 'The theme could not be reloaded', { error })) : undefined
  nitroApp.hooks.hook('request', (event) => {
    refresh?.()
    event.context.theme = data
    event.context.themeMessages = messages
  })
})
