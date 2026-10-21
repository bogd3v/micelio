import { fileURLToPath } from 'node:url'
import { dir } from '#micelio/built-in-store'
import { loadBuiltInTheme, locateBuiltInStore } from '../lib/builtInStore'
import { setActiveTheme } from '../utils/activeTheme'

// Loads and verifies the build's theme from the built-in store at boot; a defect stops the boot (ADR 0009, section 6).
export default defineNitroPlugin(() => {
  setActiveTheme(loadBuiltInTheme(locateBuiltInStore([process.argv[1] ?? '', fileURLToPath(import.meta.url)], dir)))
})
