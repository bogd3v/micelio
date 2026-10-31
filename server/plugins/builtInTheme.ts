import { fileURLToPath } from 'node:url'
import { ENTRY_FILES } from '../../modules/theme/install/constants'
import { buildSiteMode } from '#micelio/build-site-mode'
import { dir } from '#micelio/built-in-store'
import { isStaticMode } from '~/helpers/siteMode'
import { defaultLocale } from '~/interfaces/locale'
import { loadDefaultTheme, locateBuiltInStore, watchBuiltInIndex } from '../lib/builtInStore'
import { startThemeSwitch } from '../lib/themeSwitch/boot'
import { pinRequestToTheme } from '../lib/themeSwitch/request'
import type { BuiltInTheme } from '../lib/types'
import { themeDataOf, themeMessagesOf } from '../lib/themeData'
import { setThemeSwitch } from '../utils/activeTheme'
import { clearSiteCache } from '../utils/site'
import { purgePageCache } from '../utils/themeCache'

// Starts the theme switch (ADR 0009): loads the instance's default theme (NUXT_PUBLIC_THEME, else the build's) from the built-in store, a defect stops the boot,
// then compiles the remembered themes of the deployment store again and activates them before the first request.
// Plugins run in file order and this one sorts before themeMode.ts, which reads the theme in its hooks.
export default defineNitroPlugin((nitroApp) => {
  const configured = useRuntimeConfig().public.theme
  const builtInDir = locateBuiltInStore([process.argv[1] ?? '', fileURLToPath(import.meta.url)], dir)
  const views = new WeakMap<BuiltInTheme, { data: ReturnType<typeof themeDataOf>, messages: ReturnType<typeof themeMessagesOf> }>()
  function viewOf(theme: BuiltInTheme): { data: ReturnType<typeof themeDataOf>, messages: ReturnType<typeof themeMessagesOf> } {
    let view = views.get(theme)
    if (!view) {
      view = { data: themeDataOf(theme.runtime, theme.entry.files.has(ENTRY_FILES.sections)), messages: themeMessagesOf(theme.runtime) }
      views.set(theme, view)
    }
    return view
  }
  const started = startThemeSwitch({
    builtInDir,
    configured,
    env: process.env,
    reread: import.meta.dev,
    warn: (event, message, cause) => logWarn(event, message, cause === undefined ? {} : { cause }),
    onSwitch() {
      // The site settings were resolved against the theme that was replaced, and any cached page names its stylesheet (ADR 0009, section 8)
      clearSiteCache()
      void purge()
    },
  })
  async function purge(): Promise<void> {
    try {
      await purgePageCache()
    } catch (error) {
      logError('theme.purge', 'The page cache could not be purged after a theme switch', { error })
    }
  }
  setThemeSwitch(started.themeSwitch)
  // Requests wait only for the local boot work (the store clean-up and the remembered themes). The site settings are read once here, in
  // the background, so a restart picks up the theme they name; a Strapi or registry that is slow never holds a request (ADR 0009, section 6).
  const ready = (async (): Promise<void> => {
    await started.ready
    // A static build never switches (#315)
    if (isStaticMode(buildSiteMode)) return
    try {
      await loadSite(defaultLocale, { quiet: true })
    } catch {
      // Strapi is down: the remembered theme stays and the first request that reaches it decides
    }
  })()
  void ready
  // Development only: the build installs an edited theme again, and the next request sees it
  const refresh = import.meta.dev ? watchBuiltInIndex(builtInDir, () => loadDefaultTheme(builtInDir, configured), () => started.reload(), error => logError('theme.reload', 'The theme could not be reloaded', { error })) : undefined
  nitroApp.hooks.hook('request', async (event) => {
    await started.ready
    refresh?.()
    const theme = started.themeSwitch.active()
    pinRequestToTheme(event, theme, viewOf(theme))
  })
})
