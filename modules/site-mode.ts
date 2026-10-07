import { addTypeTemplate, defineNuxtModule, useLogger } from 'nuxt/kit'
import { formFieldName, hiddenFields, providerHost, validFormAction } from '../app/helpers/newsletterForm'
import { isStaticMode, SITE_MODES } from '../app/helpers/siteMode'
import type { SiteMode } from '../app/helpers/siteMode'

const BUILD_SITE_MODE_MODULE = '#micelio/build-site-mode'

// The site mode of the build (ADR 0006); the server plugin compares it with the runtime value
export default defineNuxtModule({
  meta: { name: 'micelio-site-mode' },
  setup(_options, nuxt) {
    const mode = nuxt.options.runtimeConfig.public.siteMode as SiteMode
    const formAction = process.env.NUXT_PUBLIC_NEWSLETTER_FORM_ACTION?.trim() ?? ''
    const action = isStaticMode(mode) ? validFormAction(formAction) : ''
    // Only resolved strings reach the client, so no validation code ships there (docs/performance.md)
    nuxt.options.runtimeConfig.public.newsletterProvider = {
      action,
      field: formFieldName(process.env.NUXT_PUBLIC_NEWSLETTER_FORM_FIELD),
      host: providerHost(action),
      hidden: hiddenFields(action),
    }
    if (isStaticMode(mode) && action === '') {
      // A typo must not publish a form that posts nowhere: an invalid action is the same as none
      const reason = formAction ? `${JSON.stringify(formAction.slice(0, 200))} is not an https: URL (http: is accepted only for localhost), so it is ignored and` : 'is not set, so'
      useLogger('micelio').warn(`Site mode "${mode}": NUXT_PUBLIC_NEWSLETTER_FORM_ACTION ${reason} the newsletter module is off.`)
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
