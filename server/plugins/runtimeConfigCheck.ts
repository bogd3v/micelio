import { buildSiteMode } from '#micelio/build-site-mode'
import { buildTheme } from '#micelio/build-theme'
import { isStaticMode } from '~/helpers/siteMode'
import { Locale } from '~/interfaces/locale'
import { forwardHeaders, isSafeForwardTarget, parseTrustProxy } from '../lib/clientIp'
import { insecureUpstream } from '../lib/upstreams'
import { missingOptionalRuntimeSettings, missingRuntimeSettings, moduleRequirements, modeMismatch, privacyContactWarning, themeMismatch } from '~/helpers/runtimeConfig'

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
  // Production only: development talks to a local CMS over http (ADR 0011)
  const insecure = insecureUpstream([
    { variable: 'NUXT_PUBLIC_STRAPI_URL', url: config.public.strapiUrl },
    { variable: 'NUXT_UMAMI_URL', url: config.umamiUrl },
  ])
  if (insecure) throw new Error(insecure)
  const mode = buildSiteMode
  const missing = missingRuntimeSettings(config, mode)
  if (missing.length) {
    logWarn('config.missing', `Missing runtime settings: ${missing.join(', ')}. Set them with these NUXT_* names; plain names are ignored.`)
  }
  const optional = missingOptionalRuntimeSettings(config, mode)
  if (optional.length) {
    logWarn('config.optional-missing', `Optional runtime settings not set: ${optional.join(', ')}. Without them, Strapi's media host is not allowed in the CSP${isStaticMode(mode) ? '' : ' and the fediverse features are off'}.`)
  }
  if (isStaticMode(mode)) return
  const requirements = moduleRequirements(config)
  const off = [!requirements.smtp && 'newsletter (no SMTP)', !requirements.fediverse && 'fediverse (no fediverse settings)'].filter(Boolean)
  if (off.length) {
    logWarn('config.modules-off', `Modules turned off by missing configuration: ${off.join(', ')}.`)
  }
  // Warn only, without holding the boot: loadSite() has a 3 s timeout and a failed load skips the warning
  void warnPrivacyContact()
})

async function warnPrivacyContact(): Promise<void> {
  try {
    const { site, fromStrapi } = await loadSite(Locale.English, { quiet: true })
    const warning = privacyContactWarning(site, fromStrapi)
    if (warning) logWarn('config.privacy-contact', warning)
  } catch {
    // The check is advisory
  }
}
