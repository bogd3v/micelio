import { missingOptionalRuntimeSettings, missingRuntimeSettings } from '~/helpers/runtimeConfig'

export default defineNitroPlugin(() => {
  if (import.meta.dev) return
  const config = useRuntimeConfig()
  const missing = missingRuntimeSettings(config)
  if (missing.length) {
    console.warn(`Missing runtime settings: ${missing.join(', ')}. Set them with these NUXT_* names; plain names are ignored.`)
  }
  const optional = missingOptionalRuntimeSettings(config)
  if (optional.length) {
    console.warn(`Optional runtime settings not set: ${optional.join(', ')}. Without them, Strapi's media host is not allowed in the CSP and the fediverse features are off.`)
  }
})
