import { buildSiteMode } from '#micelio/build-site-mode'
import { buildTheme } from '#micelio/build-theme'
import { isStaticMode } from '~/helpers/siteMode'
import { forwardHeaders, isSafeForwardTarget, parseTrustProxy } from '../lib/clientIp'
import { missingOptionalRuntimeSettings, missingRuntimeSettings, moduleRequirements, modeMismatch, themeMismatch } from '~/helpers/runtimeConfig'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const mismatch = themeMismatch(config, buildTheme) ?? modeMismatch(config, buildSiteMode)
  if (mismatch) throw new Error(mismatch)
  // Invalid proxy settings stop the boot instead of failing on the first visitor
  parseTrustProxy(config.trustProxy)
  const secret = strapiForwarderSecret()
  forwardHeaders(secret, '127.0.0.1')
  if (secret && !isSafeForwardTarget(config.public.strapiUrl)) {
    throw new Error('NUXT_STRAPI_FORWARDER_SECRET is set but NUXT_PUBLIC_STRAPI_URL is neither https nor a private address: the secret would travel in the clear')
  }
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
