import { buildSiteMode } from '#micelio/build-site-mode'
import { buildTheme } from '#micelio/build-theme'
import { isStaticMode } from '~/helpers/siteMode'
import { missingOptionalRuntimeSettings, missingRuntimeSettings, moduleRequirements, modeMismatch, themeMismatch } from '~/helpers/runtimeConfig'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const mismatch = themeMismatch(config, buildTheme) ?? modeMismatch(config, buildSiteMode)
  if (mismatch) throw new Error(mismatch)
  if (import.meta.dev) return
  const mode = buildSiteMode
  const missing = missingRuntimeSettings(config, mode)
  if (missing.length) {
    console.warn(`Missing runtime settings: ${missing.join(', ')}. Set them with these NUXT_* names; plain names are ignored.`)
  }
  const optional = missingOptionalRuntimeSettings(config, mode)
  if (optional.length) {
    console.warn(`Optional runtime settings not set: ${optional.join(', ')}. Without them, Strapi's media host is not allowed in the CSP${isStaticMode(mode) ? '' : ' and the fediverse features are off'}.`)
  }
  if (isStaticMode(mode)) return
  const requirements = moduleRequirements(config)
  const off = [!requirements.smtp && 'newsletter (no SMTP)', !requirements.fediverse && 'fediverse (no fediverse settings)'].filter(Boolean)
  if (off.length) {
    console.warn(`Modules turned off by missing configuration: ${off.join(', ')}.`)
  }
})
