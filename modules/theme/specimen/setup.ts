import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addTemplate, extendPages } from 'nuxt/kit'
import type { ThemeContext } from '../context'

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
  extendPages((pages) => {
    pages.push({ name: 'theme-specimen', path: '/_theme', file: join(DIR, 'page.vue') })
  })
}
