import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { defineNuxtModule, useLogger } from 'nuxt/kit'
import { indexablePage, indexedPages } from '../app/helpers/searchIndex'
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
        const site = nitro.options.output.publicDir
        // Without a data-pagefind-body anywhere Pagefind indexes whole pages (menus, footer): check first
        const pages = await Promise.all((await readdir(site, { recursive: true })).filter(file => file.endsWith('.html')).map(async file => indexablePage(await readFile(join(site, file), 'utf8'))))
        const marked = pages.filter(page => page.body)
        if (!marked.length) {
          logger.warn(`Pagefind: none of the ${pages.length} generated pages has data-pagefind-body, so nothing is indexed and the search finds nothing.`)
          return
        }
        const pagefind = await import('pagefind')
        const { index, errors } = await pagefind.createIndex()
        try {
          if (!index) throw new Error(errors.join('; '))
          const added = await index.addDirectory({ path: site })
          const written = await index.writeFiles({ outputPath: join(site, 'pagefind') })
          const problems = [...added.errors, ...written.errors]
          if (problems.length) throw new Error(problems.join('; '))
          // The island has its own palette: Pagefind's UI bundles and highlighter are dead weight in the site
          const unused = marked.every(page => page.lang) ? [...UNUSED_FILES, 'wasm.unknown.pagefind'] : UNUSED_FILES
          await Promise.all(unused.map(file => rm(join(site, 'pagefind', file), { force: true })))
          const counts = indexedPages(JSON.parse(await readFile(join(site, 'pagefind', 'pagefind-entry.json'), 'utf8')))
          const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
          logger.info(`Pagefind: ${total} page(s) indexed (${Object.entries(counts).map(([language, count]) => `${language} ${count}`).join(', ')}) from ${marked.length} marked of ${pages.length} generated`)
        } catch (error) {
          throw new Error(`Site mode "${mode}": Pagefind could not index the site (${error instanceof Error ? error.message : String(error)}).`, { cause: error })
        } finally {
          await pagefind.close()
        }
      })
    })
  },
})
