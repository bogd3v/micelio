import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addTemplate, addTypeTemplate, extendPages } from 'nuxt/kit'
import type { ThemeContext } from '../context'
import { alternateVariants } from '../layout/variants'

const DIR = dirname(fileURLToPath(import.meta.url))

/** The specimen exists in dev and when MICELIO_SPECIMEN=1 (e2e, visual regression); never in a plain production build. */
export function specimenEnabled(ctx: ThemeContext): boolean {
  return ctx.nuxt.options.dev || process.env.MICELIO_SPECIMEN === '1'
}

// ADR 0005, section 7: /_theme, the whole catalog to design a theme against (#238)
export function setupSpecimen(ctx: ThemeContext): void {
  const enabled = specimenEnabled(ctx)

  // main.css imports this template in bd.pages; it is empty when the page is not built
  addTemplate({
    filename: 'micelio/specimen.css',
    write: true,
    getContents: () => enabled ? `@import "${join(DIR, 'specimen.css')}";\n` : '',
  })

  if (!enabled) return
  // The page's messages ship only with the page
  const langDir = join(DIR, 'locales')
  ctx.nuxt.hook('i18n:registerModule', (register) => {
    register({ langDir, locales: ['en', 'es'].map(code => ({ code, file: `${code}.json` })) })
  })
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
