import { buildTheme } from '#micelio/build-theme'
import { missingOptionalRuntimeSettings, missingRuntimeSettings, moduleRequirements, themeMismatch } from '~/helpers/runtimeConfig'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const mismatch = themeMismatch(config, buildTheme)
  if (mismatch) throw new Error(mismatch)
  if (import.meta.dev) return
  const missing = missingRuntimeSettings(config)
  if (missing.length) {
    console.warn(`Missing runtime settings: ${missing.join(', ')}. Set them with these NUXT_* names; plain names are ignored.`)
  }
  const optional = missingOptionalRuntimeSettings(config)
  if (optional.length) {
    console.warn(`Optional runtime settings not set: ${optional.join(', ')}. Without them, Strapi's media host is not allowed in the CSP and the fediverse features are off.`)
  }
  const requirements = moduleRequirements(config)
  const off = [!requirements.smtp && 'newsletter (no SMTP)', !requirements.fediverse && 'fediverse (no fediverse settings)'].filter(Boolean)
  if (off.length) {
    console.warn(`Modules turned off by missing configuration: ${off.join(', ')}.`)
  }
})
