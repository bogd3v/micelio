import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addTemplate, addTypeTemplate, extendPages } from 'nuxt/kit'
import type { ThemeContext } from '../types'
import { alternateVariants } from '../layout/variants'

const DIR = dirname(fileURLToPath(import.meta.url))
const SPECIMEN_MODULE = '#micelio/specimen'

/** The specimen exists in dev and when MICELIO_SPECIMEN=1 (e2e, visual regression); never in a plain production build. */
export function specimenEnabled(ctx: ThemeContext): boolean {
  return ctx.nuxt.options.dev || process.env.MICELIO_SPECIMEN === '1'
}

// ADR 0005, section 7: /_theme, the whole catalog to design a theme against (#238)
/**
 * Adds the `/_theme` specimen page and its files to the build, when the specimen is enabled.
 *
 * @remarks
 * Runs at build time. `micelio/specimen.css` is always written, and it imports the specimen styles only when the page exists.
 * When `specimenEnabled` is true, the setup also registers the page's `en` and `es` messages, serves its media at
 * `/_theme/media/`, writes the `#micelio/specimen-variants` module with the alternate variants and its type declarations, and
 * adds the page route. `#micelio/specimen` tells the server whether the page exists, in every build.
 */
export function setupSpecimen(ctx: ThemeContext): void {
  const enabled = specimenEnabled(ctx)

  // The server writes data-layout-header only when the alternates are bundled (ADR 0009, 2026-10-22 amendment)
  addTypeTemplate({
    filename: 'types/micelio-specimen.d.ts',
    getContents: () => `declare module '${SPECIMEN_MODULE}' {\n  export const specimen: boolean\n}\n`,
  }, { nitro: true, nuxt: true })
  ctx.nuxt.hook('nitro:config', (config) => {
    config.virtual ||= {}
    config.virtual[SPECIMEN_MODULE] = `export const specimen = ${JSON.stringify(enabled)}\n`
  })

  // main.css imports this template in myc.pages; it is empty when the page is not built
  addTemplate({
    filename: 'micelio/specimen.css',
    write: true,
    getContents: () => enabled ? `@import "${join(DIR, 'specimen.css')}";\n` : '',
  })

  if (!enabled) return
  // The page's messages ship only with the page
  const langDir = join(DIR, 'locales')
  ctx.nuxt.hook('i18n:registerModule', (register) => {
    register({ langDir, locales: (['en', 'es'] as const).map(code => ({ code, file: `${code}.json` })) })
  })
  // The specimen's own images, same-origin at /_theme/media/ (only when the page exists)
  ;(ctx.nuxt.options.nitro.publicAssets ||= []).push({ dir: join(DIR, 'media'), baseURL: '/_theme/media' })
  // Not part of #micelio/theme: the active theme's data never lists the alternates
  ctx.nuxt.options.alias['#micelio/specimen-variants'] = join(ctx.nuxt.options.buildDir, 'micelio/specimen-variants.mjs')
  addTemplate({
    filename: 'micelio/specimen-variants.mjs',
    write: true,
    getContents: () => `export const variants = ${JSON.stringify(alternateVariants(ctx), null, 2)}\nexport default variants\n`,
  })
  addTypeTemplate({
    filename: 'types/micelio-specimen-variants.d.ts',
    getContents: () => `declare module '#micelio/specimen-variants' {
  export interface SpecimenVariant {
    region: string
    variant: string
    component: string
  }
  export const variants: SpecimenVariant[]
  export default variants
}
`,
  })
  extendPages((pages) => {
    pages.push({ name: 'theme-specimen', path: '/_theme', file: join(DIR, 'page.vue') })
  })
}
