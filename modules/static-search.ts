import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { defineNuxtModule, useLogger } from 'nuxt/kit'
import { isStaticMode } from '../app/helpers/siteMode'
import type { SiteMode } from '../app/helpers/siteMode'

const UNUSED_FILES = [
  'pagefind-ui.js', 'pagefind-ui.css', 'pagefind-modular-ui.js', 'pagefind-modular-ui.css',
  'pagefind-component-ui.js', 'pagefind-component-ui.css', 'pagefind-highlight.js',
]

// Static and landing builds (ADR 0006, section 4): Pagefind indexes the generated HTML into /pagefind/, one index per <html lang>.
// It runs after modules/static-routes.ts has checked the pages (a failed build throws there first).
export default defineNuxtModule({
  meta: { name: 'micelio-static-search' },
  setup(_options, nuxt) {
    const mode = nuxt.options.runtimeConfig.public.siteMode as SiteMode
    if (nuxt.options.dev || !isStaticMode(mode)) return

    const logger = useLogger('micelio')
    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('prerender:done', async () => {
        const pagefind = await import('pagefind')
        const { index, errors } = await pagefind.createIndex()
        try {
          if (!index) throw new Error(errors.join('; '))
          const site = nitro.options.output.publicDir
          const added = await index.addDirectory({ path: site })
          const written = await index.writeFiles({ outputPath: join(site, 'pagefind') })
          const problems = [...added.errors, ...written.errors]
          if (problems.length) throw new Error(problems.join('; '))
          // The island has its own palette: Pagefind's UI bundles and highlighter are dead weight in the site
          await Promise.all(UNUSED_FILES.map(file => rm(join(site, 'pagefind', file), { force: true })))
          if (added.page_count === 0) logger.warn('Pagefind found no page with data-pagefind-body: the search has nothing to find.')
          else logger.info(`Pagefind: ${added.page_count} page(s) indexed into /pagefind/`)
        } catch (error) {
          throw new Error(`Site mode "${mode}": Pagefind could not index the site (${error instanceof Error ? error.message : String(error)}).`, { cause: error })
        } finally {
          await pagefind.close()
        }
      })
    })
  },
})
