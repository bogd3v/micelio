import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { isThemePath } from './context'
import type { ThemeContext } from './context'

/** Where the theme's images are served: /theme/images/<file> (docs/adr/0005-theme-contract.md). */
const IMAGES_URL = 'theme/images'

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

  function copyImages(): void {
    rmSync(target, { recursive: true, force: true })
    mkdirSync(join(target, '..'), { recursive: true })
    cpSync(source, target, { recursive: true })
  }
  copyImages()

  // Listed before @nuxt/image in nuxt.config.ts, which reads image.dirs when it is set up and serves them as public assets
  const image = (nuxt.options as { image?: { dirs?: string[] } }).image ||= {}
  image.dirs = [...(image.dirs ?? []), publicRoot]

  // The build empties buildDir after the modules are set up, so the copy is made again once the templates are written
  nuxt.hook('app:templatesGenerated', () => {
    if (!existsSync(target)) copyImages()
  })
  nuxt.hook('builder:watch', (_event, path) => {
    if (isThemePath(ctx, path)) copyImages()
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
