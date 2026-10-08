import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ofetch } from 'ofetch'
import qs from 'qs'
import { defineNuxtModule, useLogger } from 'nuxt/kit'
import { Locale } from '../app/interfaces/locale'
import { formActionOrigin } from '../app/helpers/newsletterForm'
import { contentSecurityPolicy, inlineScripts } from '../app/helpers/securityHeaders'
import { isStaticMode } from '../app/helpers/siteMode'
import type { SiteMode } from '../app/helpers/siteMode'
import { ABOUT_ROUTES, articleRoute, BLOG_ROUTES, failsBuild, headersFile, initialRoutes, injectCspMeta, landingHomeCheck, mediaFileName, mediaUrlsIn, missingRoutes, noScriptsViolations, rewriteMediaUrls, scriptHashDisagreements, sectionPageRoute, staticFileRoutes, stripImageErrorHandlers, unreachableScripts } from '../app/helpers/staticBuild'
import { strapiRequest } from '../server/lib/strapiRequest'
import type { StrapiRequestConfig } from '../server/lib/strapiRequest'

const PAGE_SIZE = 100
// Where a page, a stylesheet or an island may name a script; media and the image cache never do
const SKIPPED_FOLDERS = new Set(['_ipx', '_media', 'fonts'])

async function filesUnder(dir: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name)) found.push(...await filesUnder(join(dir, entry.name)))
    } else found.push(join(dir, entry.name))
  }
  return found
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('base64')
}

interface SlugList {
  data?: Array<{ slug?: string }>
  meta?: { pagination?: { pageCount?: number } }
}

class LandingConfigError extends Error {}

async function hasHomePage(config: StrapiRequestConfig, locale: Locale): Promise<boolean> {
  const query = qs.stringify({ locale, populate: { homePage: { fields: ['slug'] } } })
  const response = await strapiRequest<{ data?: { homePage?: { slug?: string } | null } }>(config, `/api/site-setting?${query}`, { timeout: 30_000 })
  return Boolean(response.data?.homePage?.slug)
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
  async setup(_options, nuxt) {
    const mode = nuxt.options.runtimeConfig.public.siteMode as SiteMode
    if (nuxt.options.dev || !isStaticMode(mode)) return

    const logger = useLogger('micelio')
    // The newsletter provider receives the form post (ADR 0006, section 5); read as the module that turns the newsletter on reads it
    const newsletterOrigins = [formActionOrigin(process.env.NUXT_PUBLIC_NEWSLETTER_FORM_ACTION)].filter(Boolean)
    // Nitro skips a route that is a file of public/: the file wins
    const isPublicFile = (route: string): boolean => route !== '/' && existsSync(join(nuxt.options.rootDir, 'public', route))
    // Runtime overrides (NUXT_*) are not applied to the config at build setup
    const config: StrapiRequestConfig = {
      strapiUrl: process.env.NUXT_PUBLIC_STRAPI_URL || String(nuxt.options.runtimeConfig.public.strapiUrl || ''),
      strapiApiToken: process.env.NUXT_STRAPI_API_TOKEN || String(nuxt.options.runtimeConfig.strapiApiToken || ''),
    }

    // The published articles per locale, read once for the landing's blog switch and reused by the prerender hook
    const articleSlugs = new Map<Locale, string[]>()
    // A landing with no articles has no blog (ADR 0006, section 1). Decided here, before the build, because components read it from the runtime config (useStaticSite)
    let blogEnabled = true
    if (mode === 'landing' && !nuxt.options._prepare && config.strapiUrl && config.strapiApiToken) {
      try {
        for (const locale of Object.values(Locale)) articleSlugs.set(locale, await fetchSlugs(config, 'articles', locale))
        blogEnabled = [...articleSlugs.values()].some(slugs => slugs.length > 0)
        const withoutHome: Locale[] = []
        for (const locale of Object.values(Locale)) if (!await hasHomePage(config, locale)) withoutHome.push(locale)
        const { error, warning } = landingHomeCheck(blogEnabled, withoutHome)
        if (error) throw new LandingConfigError(error)
        if (warning) logger.warn(warning)
      } catch (error) {
        if (error instanceof LandingConfigError) throw error
        // The prerender hook reads the same content and reports the failure with its message
        logger.warn(`Landing: could not read the articles and the home pages from Strapi (${error instanceof Error ? error.message : String(error)}); the blog stays on until the build reads them again`)
        articleSlugs.clear()
        blogEnabled = true
      }
      if (!blogEnabled) logger.info('Landing: there are no published articles, so the build has no blog, category or tag pages, feeds, about page or links to them')
    }
    if (mode === 'landing') nuxt.options.runtimeConfig.public.blogEnabled = blogEnabled

    // Nothing in a static site loads the Nuxt client, so its chunks (Mermaid alone is ~8 MB) are dead weight.
    // The public assets are copied after the prerender, so this runs on their hook. A script stays when a page, a stylesheet, an island or a kept script names it, which is how a heavy island will keep its chunks (docs/performance.md, "Unused client JS")
    async function pruneScripts(publicDir: string): Promise<void> {
      const nuxtDir = join(publicDir, '_nuxt')
      if (!existsSync(nuxtDir)) return
      const scripts = new Map<string, string>()
      let before = 0
      for (const name of await readdir(nuxtDir)) {
        if (!name.endsWith('.js')) continue
        scripts.set(name, await readFile(join(nuxtDir, name), 'utf8'))
        before += (await stat(join(nuxtDir, name))).size
      }
      const roots: string[] = []
      for (const file of await filesUnder(publicDir)) {
        if (file.startsWith(`${nuxtDir}/`) && file.endsWith('.js')) continue
        if (/\.(?:html|css|js|mjs)$/.test(file)) roots.push(await readFile(file, 'utf8'))
      }
      const unused = unreachableScripts(scripts, roots)
      // The precompressed copies and maps go with the script
      await Promise.all(unused.flatMap(name => ['', '.br', '.gz', '.map'].map(suffix => rm(join(nuxtDir, `${name}${suffix}`), { force: true }))))
      const removed = before - (await Promise.all([...scripts.keys()].filter(name => !unused.includes(name)).map(async name => (await stat(join(nuxtDir, name))).size))).reduce((sum, size) => sum + size, 0)
      logger.info(`Pruned ${unused.length} of ${scripts.size} unused scripts from /_nuxt/ (${(removed / 1024 / 1024).toFixed(1)} MB of ${(before / 1024 / 1024).toFixed(1)} MB)`)
    }

    nuxt.hook('nitro:build:public-assets', nitro => pruneScripts(nitro.options.output.publicDir))

    nuxt.hook('nitro:init', (nitro) => {
      // A dead link found by the crawler is a warning; a 404 on a route we asked for, or any other error, fails the build
      const listed = new Set<string>(initialRoutes(blogEnabled))
      if (!blogEnabled) {
        // Not crawled either: a link to the blog in the content is a dead link, not a page to generate
        nitro.options.prerender.routes = nitro.options.prerender.routes.filter(route => !BLOG_ROUTES.test(route) && !ABOUT_ROUTES.test(route))
        nitro.options.prerender.ignore.push(BLOG_ROUTES, ABOUT_ROUTES)
      }
      nitro.hooks.hook('prerender:routes', async (routes) => {
        if (!config.strapiUrl) throw new Error(`Site mode "${mode}": NUXT_PUBLIC_STRAPI_URL is not set; the build reads the content from Strapi.`)
        if (!config.strapiApiToken) throw new Error(`Site mode "${mode}": NUXT_STRAPI_API_TOKEN is not set; the build needs a read-only Strapi token (docs/security.md).`)

        let articles = 0
        let pages = 0
        try {
          for (const locale of Object.values(Locale)) {
            for (const slug of articleSlugs.get(locale) ?? await fetchSlugs(config, 'articles', locale)) {
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
        for (const route of staticFileRoutes(blogEnabled)) listed.add(route)
        if (!blogEnabled) for (const route of routes) if (BLOG_ROUTES.test(route) || ABOUT_ROUTES.test(route)) routes.delete(route)
        for (const route of listed) routes.add(route)
        logger.info(`Static routes: ${articles} articles and ${pages} pages from Strapi, plus ${blogEnabled ? 'feeds, ' : ''}sitemap and robots.txt`)
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
