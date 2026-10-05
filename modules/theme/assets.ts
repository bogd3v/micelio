import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { useLogger } from 'nuxt/kit'
import { isThemePath } from './context'
import type { ThemeContext } from './context'

/** Where the theme's images are served: /theme/images/<file> (docs/adr/0005-theme-contract.md). */
const IMAGES_URL = 'theme/images'

/** Files copied from a theme's images/; anything else is skipped with a warning. */
const IMAGE_FILE = /\.(png|jpe?g|webp|avif|gif|svg)$/i

/** The static files get no capabilities: an SVG opened directly cannot run scripts or load anything. */
const IMAGES_CSP = 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox'

const logger = useLogger('micelio-theme')

/** The theme's fonts/ is served at /fonts/; its preloaded files get a <link rel="preload">. */
function setupFonts(ctx: ThemeContext): void {
  const { nuxt, dir } = ctx
  const fontsDir = join(dir, 'fonts')
  if (existsSync(fontsDir)) {
    const publicAssets = (nuxt.options.nitro.publicAssets ||= [])
    publicAssets.push({ dir: fontsDir, baseURL: '/fonts' })
  }
  const links = (nuxt.options.app.head.link ||= [])
  for (const font of ctx.load().manifest.fonts.filter(font => font.preload)) {
    links.push({ rel: 'preload', href: `/fonts/${font.file}`, as: 'font', type: 'font/woff2', crossorigin: '' })
  }
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

  // A symlink is an error (it could point outside the theme); an unexpected file type is skipped with a warning
  function allowed(path: string): boolean {
    const stats = lstatSync(path)
    const shown = `${ctx.id}/images/${relative(source, path)}`
    if (stats.isSymbolicLink()) throw new Error(`Theme "${ctx.id}": ${shown} is a symlink; copy the file instead`)
    if (stats.isDirectory() || IMAGE_FILE.test(path)) return true
    logger.warn(`Theme "${ctx.id}": ${shown} is not an image (png, jpg, webp, avif, gif, svg) and is not served`)
    return false
  }

  function copyImages(): void {
    rmSync(target, { recursive: true, force: true })
    if (!existsSync(source)) return
    mkdirSync(join(target, '..'), { recursive: true })
    cpSync(source, target, { recursive: true, filter: allowed })
  }
  copyImages()

  // @nuxt/image reads image.dirs when it is set up, so this module has to be set up first
  const installed = (nuxt.options._installedModules ?? []).some(({ meta }) => meta?.name === '@nuxt/image')
  if (installed) throw new Error('micelio-theme must be listed before @nuxt/image in nuxt.config.ts: image.dirs is read when @nuxt/image is set up')
  const image = (nuxt.options as { image?: { dirs?: string[] } }).image ||= {}
  image.dirs = [...(image.dirs ?? []), publicRoot]
  ;(nuxt.options.routeRules ||= {})[`/${IMAGES_URL}/**`] = { headers: { 'Content-Security-Policy': IMAGES_CSP } }

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

/** Registers the theme's i18n/<locale>.json files with @nuxtjs/i18n; they go through the same precompiler as the core ones. */
function setupMessages(ctx: ThemeContext): void {
  const langDir = join(ctx.dir, 'i18n')
  if (!existsSync(langDir)) return
  const files = readdirSync(langDir).filter(file => file.endsWith('.json'))
  const locales = files.map(file => ({ code: basename(file, '.json'), file }))
  ctx.nuxt.hook('i18n:registerModule', (register) => {
    register({ langDir, locales })
  })
}

export function setupAssets(ctx: ThemeContext): void {
  setupFonts(ctx)
  setupImages(ctx)
  setupMessages(ctx)
}
