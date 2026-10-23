import { cpSync, existsSync, lstatSync, mkdirSync, rmSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { useLogger } from 'nuxt/kit'
import type { ThemeContext } from './types'
import { IMAGES_URL, IMAGE_FILE } from './constants'
import { discoverThemes } from './themes'
import { STATIC_CSP } from '../../app/constants/security'

const logger = useLogger('micelio-theme')

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

/** A theme whose `images/` the build serves, and the URL folder it is served at. */
interface ServedImages {
  id: string
  source: string
  url: string
}

/**
 * The image folders the build serves: the build theme's at `/theme/images/`, and those of every other theme whose slots are
 * compiled in at `/theme/<id>/images/` (ADR 0009, amendment of 2026-10-23). A theme without `images/` is left out.
 */
export function servedImages(buildTheme: { id: string, dir: string }, themes: readonly { id: string, dir: string }[]): ServedImages[] {
  const others = themes.filter(theme => theme.id !== buildTheme.id && existsSync(join(theme.dir, 'slots')))
  return [
    { id: buildTheme.id, source: join(buildTheme.dir, 'images'), url: IMAGES_URL },
    ...others.map(theme => ({ id: theme.id, source: join(theme.dir, 'images'), url: `theme/${theme.id}/images` })),
  ].filter(served => existsSync(served.source))
}

/**
 * The themes' images/ are served under /theme/ (`servedImages`). IPX only reads public directories and
 * rejects symlinks, so the files are copied under a public root that also goes into image.dirs.
 */
function setupImages(ctx: ThemeContext): void {
  const { nuxt } = ctx
  const served = servedImages(ctx, discoverThemes(ctx.roots))
  if (served.length === 0) return
  const publicRoot = join(nuxt.options.buildDir, 'micelio/public')

  function copyImages(only?: string): void {
    for (const { id, source, url } of served) {
      // copyServed names the theme in its messages
      if (only === undefined || only === id) copyServed({ ...ctx, id }, source, join(publicRoot, url), 'images', IMAGE_FILE, 'an image (png, jpg, webp, avif, gif, svg)')
    }
  }
  copyImages()

  // @nuxt/image reads image.dirs when it is set up, so this module has to be set up first
  const installed = (nuxt.options._installedModules ?? []).some(({ meta }) => meta?.name === '@nuxt/image')
  if (installed) throw new Error('micelio-theme must be listed before @nuxt/image in nuxt.config.ts: image.dirs is read when @nuxt/image is set up')
  const image = (nuxt.options as { image?: { dirs?: string[] } }).image ||= {}
  image.dirs = [...(image.dirs ?? []), publicRoot]
  // No page lives under /theme/ (the specimen is /_theme)
  ;(nuxt.options.routeRules ||= {})['/theme/**'] = { headers: { 'Content-Security-Policy': STATIC_CSP } }

  // The build empties buildDir after the modules are set up, so the copy is made again once the templates are written
  nuxt.hook('app:templatesGenerated', () => {
    if (served.some(({ url }) => !existsSync(join(publicRoot, url)))) copyImages()
  })
  nuxt.hook('builder:watch', (_event, path) => {
    const abs = [resolve(nuxt.options.srcDir, path), resolve(nuxt.options.rootDir, path)]
    const theme = served.find(({ source }) => abs.some(file => file.startsWith(join(source, '..') + sep)))
    if (!theme) return
    try {
      copyImages(theme.id)
    } catch (error) {
      logger.error((error as Error).message)
    }
  })
}

/**
 * Serves the build theme's images and those of the other themes whose slots are compiled in, at build time.
 *
 * @remarks
 * `images/` is served at `/theme/images/`, and the images of every other theme whose slots are compiled in at
 * `/theme/<id>/images/`, copied under `micelio/` in the build folder with the `STATIC_CSP` header, because IPX reads
 * public directories. A missing folder is skipped. The fonts are files of the theme's store entry, served at `/_t/<digest>/fonts/`. The theme's messages are compiled when it is installed and reach the pages from the store.
 * Images are copied again when they change in dev.
 *
 * @throws `Error` when a file in `images/` is a symlink, or when `@nuxt/image` was set up before this module
 * and the theme has an `images/` folder.
 */
export function setupAssets(ctx: ThemeContext): void {
  setupImages(ctx)
}
