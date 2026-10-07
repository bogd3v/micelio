import { existsSync } from 'node:fs'
import { join } from 'node:path'
import qs from 'qs'
import { defineNuxtModule, useLogger } from 'nuxt/kit'
import { Locale } from '../app/interfaces/locale'
import { isStaticMode } from '../app/helpers/siteMode'
import type { SiteMode } from '../app/helpers/siteMode'
import { articleRoute, failsBuild, missingRoutes, noScriptsViolations, sectionPageRoute, STATIC_INITIAL_ROUTES, staticFileRoutes } from '../app/helpers/staticBuild'
import { strapiRequest } from '../server/lib/strapiRequest'
import type { StrapiRequestConfig } from '../server/lib/strapiRequest'

const PAGE_SIZE = 100

interface SlugList {
  data?: Array<{ slug?: string }>
  meta?: { pagination?: { pageCount?: number } }
}

async function fetchSlugs(config: StrapiRequestConfig, collection: 'articles' | 'pages', locale: Locale): Promise<string[]> {
  const slugs: string[] = []
  for (let page = 1, pageCount = 1; page <= pageCount; page++) {
    const query = qs.stringify({ locale, fields: ['slug'], pagination: { page, pageSize: PAGE_SIZE }, sort: 'slug:asc' })
    const response = await strapiRequest<SlugList>(config, `/api/${collection}?${query}`, { timeout: 30_000 })
    for (const { slug } of response.data ?? []) if (slug) slugs.push(slug)
    pageCount = response.meta?.pagination?.pageCount ?? 1
  }
  return slugs
}

// Static and landing builds (ADR 0006, section 7): the routes that crawlLinks cannot know come from Strapi,
// and the generated pages are checked for what noScripts must have removed (section 3).
export default defineNuxtModule({
  meta: { name: 'micelio-static-routes' },
  setup(_options, nuxt) {
    const mode = nuxt.options.runtimeConfig.public.siteMode as SiteMode
    if (nuxt.options.dev || !isStaticMode(mode)) return

    const logger = useLogger('micelio')
    // Nitro skips a route that is a file of public/ (robots.txt): the file wins
    const isPublicFile = (route: string): boolean => route !== '/' && existsSync(join(nuxt.options.rootDir, 'public', route))
    // Runtime overrides (NUXT_*) are not applied to the config at build setup
    const config: StrapiRequestConfig = {
      strapiUrl: process.env.NUXT_PUBLIC_STRAPI_URL || String(nuxt.options.runtimeConfig.public.strapiUrl || ''),
      strapiApiToken: process.env.NUXT_STRAPI_API_TOKEN || String(nuxt.options.runtimeConfig.strapiApiToken || ''),
    }

    nuxt.hook('nitro:init', (nitro) => {
      // A dead link found by the crawler is a warning; a 404 on a route we asked for, or any other error, fails the build
      const listed = new Set<string>(STATIC_INITIAL_ROUTES)
      nitro.hooks.hook('prerender:routes', async (routes) => {
        if (!config.strapiUrl) throw new Error(`Site mode "${mode}": NUXT_PUBLIC_STRAPI_URL is not set; the build reads the content from Strapi.`)
        if (!config.strapiApiToken) throw new Error(`Site mode "${mode}": NUXT_STRAPI_API_TOKEN is not set; the build needs a read-only Strapi token (docs/security.md).`)

        let articles = 0
        let pages = 0
        try {
          for (const locale of Object.values(Locale)) {
            for (const slug of await fetchSlugs(config, 'articles', locale)) {
              listed.add(articleRoute(slug, locale))
              articles++
            }
            for (const slug of await fetchSlugs(config, 'pages', locale)) {
              listed.add(sectionPageRoute(slug, locale))
              pages++
            }
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          throw new Error(`Site mode "${mode}": could not read the content from Strapi at ${config.strapiUrl} (${reason}). Check that it is reachable and that the token can read articles and pages.`, { cause: error })
        }
        for (const route of staticFileRoutes()) listed.add(route)
        for (const route of listed) routes.add(route)
        logger.info(`Static routes: ${articles} articles and ${pages} pages from Strapi, plus feeds, sitemap and robots.txt`)
      })

      const violations = new Map<string, string[]>()
      const failed: string[] = []
      nitro.hooks.hook('prerender:generate', (route) => {
        if (route.error && failsBuild(route.route, route.error.statusCode, listed)) failed.push(`${route.route} (${route.error.message})`)
        if (!route.fileName?.endsWith('.html')) return
        const found = noScriptsViolations(route.contents ?? '')
        if (found.length) violations.set(route.route, found)
      })
      nitro.hooks.hook('prerender:done', ({ prerenderedRoutes }) => {
        failed.push(...missingRoutes([...listed].filter(route => !isPublicFile(route)), prerenderedRoutes.map(({ route }) => route)).map(route => `${route} (not prerendered)`))
        if (failed.length) throw new Error(`Site mode "${mode}": ${failed.length} route(s) failed or are missing:\n  ${failed.slice(0, 10).join('\n  ')}`)
        if (!violations.size) return
        const list = [...violations].slice(0, 10).map(([route, found]) => `  ${route}: ${found.join(', ')}`).join('\n')
        throw new Error(`Site mode "${mode}": ${violations.size} generated page(s) still load Nuxt's client (noScripts did not apply). See "Plan B" in docs/adr/0006-site-modes.md, section 3.\n${list}`)
      })
    })
  },
})
