import { fileURLToPath } from 'node:url'
import { dir } from '#micelio/built-in-store'
import { loadBuiltInTheme, locateBuiltInStore } from '../lib/builtInStore'
import { themeDataOf, themeMessagesOf } from '../lib/themeData'
import { setActiveTheme } from '../utils/activeTheme'

// Loads and verifies the build's theme from the built-in store at boot; a defect stops the boot (ADR 0009, section 6).
// Plugins run in file order and this one sorts before themeMode.ts, which reads the theme in its hooks.
export default defineNitroPlugin((nitroApp) => {
  const theme = loadBuiltInTheme(locateBuiltInStore([process.argv[1] ?? '', fileURLToPath(import.meta.url)], dir))
  setActiveTheme(theme)
  const data = themeDataOf(theme.runtime)
  const messages = themeMessagesOf(theme.runtime)
  nitroApp.hooks.hook('request', (event) => {
    event.context.theme = data
    event.context.themeMessages = messages
  })
})
