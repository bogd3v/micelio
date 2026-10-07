import { addTypeTemplate, defineNuxtModule, useLogger } from 'nuxt/kit'
import { isStaticMode, SITE_MODES } from '../app/helpers/siteMode'
import type { SiteMode } from '../app/helpers/siteMode'

const BUILD_SITE_MODE_MODULE = '#micelio/build-site-mode'

// The site mode of the build (ADR 0006); the server plugin compares it with the runtime value
export default defineNuxtModule({
  meta: { name: 'micelio-site-mode' },
  setup(_options, nuxt) {
    const mode = nuxt.options.runtimeConfig.public.siteMode as SiteMode
    if (isStaticMode(mode) && !process.env.NUXT_PUBLIC_NEWSLETTER_FORM_ACTION) {
      useLogger('micelio').warn(`Site mode "${mode}": NUXT_PUBLIC_NEWSLETTER_FORM_ACTION is not set, so the newsletter module is off.`)
    }
    addTypeTemplate({
      filename: 'types/micelio-site-mode.d.ts',
      getContents: () => `declare module '${BUILD_SITE_MODE_MODULE}' {\n  export const buildSiteMode: ${SITE_MODES.map(name => `'${name}'`).join(' | ')}\n}\n`,
    }, { nitro: true, nuxt: true })
    nuxt.hook('nitro:config', (config) => {
      config.virtual ||= {}
      config.virtual[BUILD_SITE_MODE_MODULE] = `export const buildSiteMode = ${JSON.stringify(mode)}`
    })
  },
})
