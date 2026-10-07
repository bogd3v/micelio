import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ofetch } from 'ofetch'
import qs from 'qs'
import { defineNuxtModule, useLogger } from 'nuxt/kit'
import { Locale } from '../app/interfaces/locale'
import { formActionOrigin } from '../app/helpers/newsletterForm'
import { contentSecurityPolicy, inlineScripts } from '../app/helpers/securityHeaders'
import { isStaticMode } from '../app/helpers/siteMode'
import type { SiteMode } from '../app/helpers/siteMode'
import { articleRoute, failsBuild, headersFile, injectCspMeta, mediaFileName, mediaUrlsIn, missingRoutes, noScriptsViolations, rewriteMediaUrls, scriptHashDisagreements, sectionPageRoute, STATIC_INITIAL_ROUTES, staticFileRoutes, stripImageErrorHandlers } from '../app/helpers/staticBuild'
import { strapiRequest } from '../server/lib/strapiRequest'
import type { StrapiRequestConfig } from '../server/lib/strapiRequest'

const PAGE_SIZE = 100

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('base64')
}

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
    // The newsletter provider receives the form post (ADR 0006, section 5); read as the module that turns the newsletter on reads it
    const newsletterOrigins = [formActionOrigin(process.env.NUXT_PUBLIC_NEWSLETTER_FORM_ACTION)].filter(Boolean)
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

      // Static pages load no Nuxt client and copy their images and media into the site: no image origin is needed
      function staticPolicy(hashes: string[], meta: boolean): string {
        return contentSecurityPolicy({ scriptHashes: hashes, imageOrigins: [], imageBlobs: false, wasmEval: true, formOrigins: newsletterOrigins, meta })
      }
      async function writeHeaders(): Promise<void> {
        const different = scriptHashDisagreements(scriptHashes)
        if (different.length) {
          const list = different.slice(0, 10).map(route => `  ${route}: ${scriptHashes.get(route)?.join(', ') || '(no inline script)'}`).join('\n')
          throw new Error(`Site mode "${mode}": ${different.length} page(s) have inline scripts that differ from the other pages, so one CSP for /* cannot cover them (ADR 0006, section 7). SHA-256 of their scripts:\n${list}`)
        }
        const hashes = [...scriptHashes.values()][0] ?? []
        await writeFile(join(nitro.options.output.publicDir, '_headers'), headersFile(staticPolicy(hashes, false)))
        logger.info(`Wrote _headers (${hashes.length} script hash(es), ${scriptHashes.size} pages)`)
      }

      const violations = new Map<string, string[]>()
      const failed: string[] = []

      // Raw <img> and <video> files of Strapi (SVGs, videos) bypass _ipx: copy them into the site so no page asks Strapi at runtime
      // Only Strapi's /uploads/ and the media host: any other path of the Strapi origin (its API, its admin) is not media
      const mediaPrefixes = [
        ...(config.strapiUrl ? [`${new URL(config.strapiUrl).origin}/uploads/`] : []),
        ...(process.env.NUXT_MEDIA_URL || nuxt.options.runtimeConfig.mediaUrl ? [`${new URL(process.env.NUXT_MEDIA_URL || String(nuxt.options.runtimeConfig.mediaUrl)).origin}/`] : []),
      ]
      const localMedia = new Map<string, Promise<string>>()
      function copyMedia(url: string): Promise<string> {
        let path = localMedia.get(url)
        if (!path) {
          path = (async () => {
            const blob = await ofetch<Blob, 'blob'>(url, { responseType: 'blob', timeout: 60_000 })
            if (!/^(image|video|audio)\//.test(blob.type)) throw new Error(`${url} is ${blob.type || 'of unknown type'}, not an image, video or audio`)
            const bytes = Buffer.from(await blob.arrayBuffer())
            // Named by its bytes: a file that changes behind the same URL gets a new name, so /_media/ can be immutable
            const name = mediaFileName(url, createHash('sha256').update(bytes).digest('hex').slice(0, 8))
            await mkdir(join(nitro.options.output.publicDir, '_media'), { recursive: true })
            await writeFile(join(nitro.options.output.publicDir, '_media', name), bytes)
            return `/_media/${name}`
          })()
          localMedia.set(url, path)
        }
        return path
      }

      // Inline scripts of every page; the policy and its meta fallback come from them (ADR 0004, ADR 0006 section 7)
      const scriptHashes = new Map<string, string[]>()

      nitro.hooks.hook('prerender:generate', async (route) => {
        // Hosts must answer unknown paths with 404.html: no SPA fallback file
        if (route.route === '/200.html') {
          route.skip = true
          return
        }
        if (route.fileName?.endsWith('.html') && !route.error && route.contents) {
          route.contents = stripImageErrorHandlers(route.contents)
          const urls = mediaUrlsIn(route.contents, mediaPrefixes)
          if (urls.length) {
            try {
              const paths = new Map(await Promise.all(urls.map(async url => [url, await copyMedia(url)] as const)))
              route.contents = rewriteMediaUrls(route.contents, paths)
            } catch (error) {
              failed.push(`${route.route} (media: ${error instanceof Error ? error.message : String(error)})`)
            }
          }
        }
        if (route.error && failsBuild(route.route, route.error.statusCode, listed)) failed.push(`${route.route} (${route.error.message})`)
        if (!route.fileName?.endsWith('.html')) return
        const found = noScriptsViolations(route.contents ?? '')
        if (found.length) violations.set(route.route, found)
        if (route.error || !route.contents) return
        const hashes = inlineScripts(route.contents).map(sha256)
        scriptHashes.set(route.route, hashes)
        try {
          route.contents = injectCspMeta(route.contents, staticPolicy(hashes, true))
        } catch (error) {
          failed.push(`${route.route} (${error instanceof Error ? error.message : String(error)})`)
        }
      })
      nitro.hooks.hook('prerender:done', async ({ prerenderedRoutes }) => {
        failed.push(...missingRoutes([...listed].filter(route => !isPublicFile(route)), prerenderedRoutes.map(({ route }) => route)).map(route => `${route} (not prerendered)`))
        if (failed.length) throw new Error(`Site mode "${mode}": ${failed.length} route(s) failed or are missing:\n  ${failed.slice(0, 10).join('\n  ')}`)
        if (!violations.size) await writeHeaders()
        if (!violations.size) return
        const list = [...violations].slice(0, 10).map(([route, found]) => `  ${route}: ${found.join(', ')}`).join('\n')
        throw new Error(`Site mode "${mode}": ${violations.size} generated page(s) still load Nuxt's client (noScripts did not apply). See "Plan B" in docs/adr/0006-site-modes.md, section 3.\n${list}`)
      })
    })
  },
})
