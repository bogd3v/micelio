import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { useLogger } from 'nuxt/kit'
import { isThemePath } from './context'
import type { ThemeContext } from './types'
import { IMAGES_URL } from './data'

/** Files copied from a theme's images/; anything else is skipped with a warning. */
const IMAGE_FILE = /\.(png|jpe?g|webp|avif|gif|svg)$/i

/** The static files of a theme get no capabilities: an SVG opened directly cannot run scripts or load anything. */
export const STATIC_CSP = 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox'

const logger = useLogger('micelio-theme')

/** Files copied from a theme's fonts/ (fonts and their license texts); anything else is not served. */
export const FONT_FILE = /\.(woff2?|txt)$/i

/**
 * Copies the files of `source` that match `pattern` to `target`. A symlink is an error (it could point outside the theme);
 * another file type is skipped with a warning.
 */
export function copyServed(ctx: ThemeContext, source: string, target: string, folder: string, pattern: RegExp, description: string): void {
  function allowed(path: string): boolean {
    const stats = lstatSync(path)
    const shown = `${ctx.id}/${folder}/${relative(source, path)}`
    if (stats.isSymbolicLink()) throw new Error(`Theme "${ctx.id}": ${shown} is a symlink; copy the file instead`)
    if (stats.isDirectory() || pattern.test(path)) return true
    logger.warn(`Theme "${ctx.id}": ${shown} is not ${description} and is not served`)
    return false
  }
  rmSync(target, { recursive: true, force: true })
  if (!existsSync(source)) return
  mkdirSync(join(target, '..'), { recursive: true })
  cpSync(source, target, { recursive: true, filter: allowed })
}

/**
 * The theme's woff, woff2 and txt (license) files of fonts/ are served at /fonts/ (copied under the build, like the images); the
 * preloaded ones get a <link rel="preload"> in server/plugins/themeMode.ts. A change to fonts/ needs a dev restart.
 */
function setupFonts(ctx: ThemeContext): void {
  const { nuxt, dir } = ctx
  const source = join(dir, 'fonts')
  if (existsSync(source)) {
    const target = join(nuxt.options.buildDir, 'micelio/fonts')
    copyServed(ctx, source, target, 'fonts', FONT_FILE, 'a font or a license (woff, woff2, txt)')
    ;(nuxt.options.nitro.publicAssets ||= []).push({ dir: target, baseURL: '/fonts' })
    ;(nuxt.options.routeRules ||= {})['/fonts/**'] = { headers: { 'Content-Security-Policy': STATIC_CSP } }
    // The build empties buildDir after the modules are set up, so the copy is made again once the templates are written
    nuxt.hook('app:templatesGenerated', () => {
      if (!existsSync(target)) copyServed(ctx, source, target, 'fonts', FONT_FILE, 'a font or a license (woff, woff2, txt)')
    })
  }
  // The preload links are rendered per request by server/plugins/themeMode.ts (an emitted display font can drop one)
}

/**
 * The theme's images/ is served at /theme/images/. IPX only reads public directories and
 * rejects symlinks, so the files are copied under a public root that also goes into image.dirs.
 */
function setupImages(ctx: ThemeContext): void {
  const { nuxt, dir } = ctx
  const source = join(dir, 'images')
  if (!existsSync(source)) return
  const publicRoot = join(nuxt.options.buildDir, 'micelio/public')
  const target = join(publicRoot, IMAGES_URL)

  function copyImages(): void {
    copyServed(ctx, source, target, 'images', IMAGE_FILE, 'an image (png, jpg, webp, avif, gif, svg)')
  }
  copyImages()

  // @nuxt/image reads image.dirs when it is set up, so this module has to be set up first
  const installed = (nuxt.options._installedModules ?? []).some(({ meta }) => meta?.name === '@nuxt/image')
  if (installed) throw new Error('micelio-theme must be listed before @nuxt/image in nuxt.config.ts: image.dirs is read when @nuxt/image is set up')
  const image = (nuxt.options as { image?: { dirs?: string[] } }).image ||= {}
  image.dirs = [...(image.dirs ?? []), publicRoot]
  ;(nuxt.options.routeRules ||= {})[`/${IMAGES_URL}/**`] = { headers: { 'Content-Security-Policy': STATIC_CSP } }

  // The build empties buildDir after the modules are set up, so the copy is made again once the templates are written
  nuxt.hook('app:templatesGenerated', () => {
    if (!existsSync(target)) copyImages()
  })
  nuxt.hook('builder:watch', (_event, path) => {
    if (!isThemePath(ctx, path)) return
    try {
      copyImages()
    } catch (error) {
      logger.error((error as Error).message)
    }
  })
}

/** Registers the theme's i18n/<locale>.json files with `@nuxtjs/i18n`; they go through the same precompiler as the core ones. */
function setupMessages(ctx: ThemeContext): void {
  const langDir = join(ctx.dir, 'i18n')
  if (!existsSync(langDir)) return
  const files = readdirSync(langDir).filter(file => file.endsWith('.json'))
  const locales = files.map(file => ({ code: basename(file, '.json'), file }))
  ctx.nuxt.hook('i18n:registerModule', (register) => {
    register({ langDir, locales })
  })
}

/**
 * Serves the active theme's fonts, images and messages, at build time.
 *
 * @remarks
 * `fonts/` is served at `/fonts/` and `images/` at `/theme/images/`, both copied under `micelio/` in the build folder with the
 * `STATIC_CSP` header. The theme's `i18n/<locale>.json` files are registered with `@nuxtjs/i18n`. A missing folder is skipped.
 * Images are copied again when they change in dev; the fonts are copied once, so a change to `fonts/` needs a dev restart.
 *
 * @throws `Error` when a file in `fonts/` or `images/` is a symlink, or when `@nuxt/image` was set up before this module
 * and the theme has an `images/` folder.
 */
export function setupAssets(ctx: ThemeContext): void {
  setupFonts(ctx)
  setupImages(ctx)
  setupMessages(ctx)
}
