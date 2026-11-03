import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { addTypeTemplate, useLogger } from 'nuxt/kit'
import { STATIC_AUDIT_PATH } from '../../app/constants/site'
import { isStaticMode, parseSiteMode } from '../../app/helpers/siteMode'
import { isThemePath } from './context'
import { coreBuildOf } from './core-build'
import { buildInstallWorker } from './install/bundle-worker'
import { loadHooks } from './hooks'
import { readLayoutCss } from './layout/variants'
import { BUILT_IN_INDEX, BUILT_IN_STORE_PATH, INSTALL_INPUTS, SERVE_PREFIX } from './install/constants'
import { installTheme } from './install/install'
import { lockedDigest } from './install/pinned'
import type { BuiltInIndex } from './install/types'
import { coreVersion } from './registry/commands'
import { readLock } from './registry/lock'
import { adoptResolvedTheme, copyPublishedFiles, resolveStaticTheme } from './static-theme'
import type { StaticTheme } from './static-theme'
import { discoverThemes } from './themes'
import type { ThemeContext } from './types'

const MODULE = '#micelio/built-in-store'
/** A store folder untouched for this long belongs to a build nobody is running any more. */
const STALE_STORE_MS = 60 * 60 * 1000

/**
 * Installs every theme of the build into the built-in store and records them in its index (ADR 0009, section 1).
 *
 * @remarks
 * Runs at build and dev setup, in the build's process: the themes are the operator's own (`themes/`, the lock's, `MICELIO_THEME_DIRS`)
 * and were validated by `createContext`. Each is compiled for this build (`coreBuild` is a hash of the compiler's sources and of the layout variants' CSS, which each entry carries, so the same sources give the same URLs), code themes included,
 * since their slots are compiled into the same build. The store lives under `node_modules/.cache/micelio/built-in-store/<build id>/`, is rebuilt on every
 * start, folders older than an hour are removed, and a production build copies it to `.output/server/micelio/store`. The server finds it by `#micelio/built-in-store` in
 * development and next to its entry in production. A static build also resolves the theme the site settings name and publishes its files at `/_t/<digest>/` (the build's theme when they name none), and
 * development installs a theme again when its folder changes.
 */
export async function setupBuiltInStore(ctx: ThemeContext): Promise<void> {
  const { nuxt } = ctx
  const cache = join(nuxt.options.rootDir, 'node_modules/.cache/micelio/built-in-store')
  // One folder per build id: builds that run at once (tests, CI jobs on one checkout) never share a store
  const dir = join(cache, nuxt.options.buildId)
  nuxt.options.alias[MODULE] = join(nuxt.options.buildDir, 'micelio/built-in-store.mjs')
  nuxt.hook('nitro:config', (config) => {
    config.virtual ||= {}
    config.virtual[MODULE] = `export const dir = ${JSON.stringify(dir)}\n`
  })
  addTypeTemplate({
    filename: 'types/micelio-built-in-store.d.ts',
    getContents: () => `declare module '${MODULE}' {\n  export const dir: string\n}\n`,
  }, { nitro: true, nuxt: true })
  // `nuxt prepare` and type checks need the types, not the compiled themes
  if (nuxt.options._prepare) return
  const hooks = loadHooks(nuxt.options.srcDir)
  const lock = readLock(nuxt.options.rootDir)
  const layoutRoot = join(nuxt.options.srcDir, 'theme/layout')
  let layoutCss = readLayoutCss(layoutRoot)
  const index: BuiltInIndex = { coreBuild: coreBuildOf(layoutCss), buildTheme: ctx.id, themes: {} }
  for (const old of existsSync(cache) ? readdirSync(cache) : []) {
    if (Date.now() - statSync(join(cache, old)).mtimeMs > STALE_STORE_MS) rmSync(join(cache, old), { recursive: true, force: true })
  }
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  // A server install (ADR 0009, #403) checks a package against the same hooks and compiles it with the same variant CSS as these entries
  const writeInputs = (): void => writeFileSync(join(dir, INSTALL_INPUTS), JSON.stringify({ hooks: JSON.parse(readFileSync(join(nuxt.options.srcDir, 'theme/hooks.json'), 'utf8')) as unknown, layoutCss }))

  async function install(themeDir: string, id: string): Promise<void> {
    const result = await installTheme({ kind: 'folder', dir: themeDir }, { storeDir: dir, hooks, coreBuild: index.coreBuild, allowCode: true, buildChecksOnly: true, layoutCss })
    for (const warning of result.warnings) useLogger('micelio-theme').warn(`Theme "${id}": ${warning}`)
    // The lock's digest names the pulled package; a local folder that shadows it (outside CI) is other bytes and carries no pin
    const pinned = lockedDigest(lock, id, themeDir)
    index.themes[id] = { digest: result.digest, version: result.manifest.version, code: result.manifest.code, ...(pinned !== undefined && { pinned }) }
  }
  for (const theme of discoverThemes(ctx.roots)) await install(theme.dir, theme.id)
  writeFileSync(join(dir, BUILT_IN_INDEX), JSON.stringify(index))
  writeInputs()

  if (nuxt.options.nitro.static) {
    const theme = await resolveForStaticBuild(ctx, dir, index)
    exposeStatically(nuxt, dir, theme?.identity.digest ?? index.themes[ctx.id]!.digest)
    if (theme) auditResolvedTheme(nuxt, theme)
  }
  if (nuxt.options.dev) {
    // The dev server reads the cache folder itself, which is the one an edit updates; a copy next to its entry would shadow it
    reloadOnEdit(ctx, install, () => writeFileSync(join(dir, BUILT_IN_INDEX), JSON.stringify(index)), async () => {
      const edited = readLayoutCss(layoutRoot)
      if (JSON.stringify(edited) === JSON.stringify(layoutCss)) return false
      layoutCss = edited
      index.coreBuild = coreBuildOf(layoutCss)
      writeInputs()
      for (const theme of discoverThemes(ctx.roots)) await install(theme.dir, theme.id)
      return true
    })
    return
  }
  nuxt.hook('nitro:init', (nitro) => {
    nitro.hooks.hook('compiled', async (compiled) => {
      const { serverDir } = compiled.options.output
      cpSync(dir, join(serverDir, BUILT_IN_STORE_PATH), { recursive: true })
      // The server installs themes in a child process (ADR 0009, section 2), which needs a built worker
      if (!nuxt.options.nitro.static) await buildInstallWorker(nuxt.options.rootDir, serverDir)
    })
  })
}

/**
 * A static or landing build takes the theme the site settings name, from the image or the registry (ADR 0009, section 7, #315).
 *
 * @remarks
 * The settings are read with the build token and resolved by the server's theme switch (`resolveStaticTheme`), so the pin, the tier, the signed
 * index, the digest and the attestation are checked as they are for a running server. A theme the image lacks is installed into `dir`, added to
 * the index, and made the default of the prerender (`NUXT_PUBLIC_THEME`), which loads it like any built-in theme. A theme that is refused fails
 * the build, and the entrypoint of the builder image then leaves the published site as it was. When the settings name no theme, the default theme applies.
 */
async function resolveForStaticBuild(ctx: ThemeContext, dir: string, index: BuiltInIndex): Promise<StaticTheme | undefined> {
  const { nuxt } = ctx
  if (!isStaticMode(parseSiteMode(nuxt.options.runtimeConfig.public.siteMode))) return undefined
  const logger = useLogger('micelio-theme')
  const theme = await resolveStaticTheme({
    builtInDir: dir,
    configured: ctx.id,
    env: process.env,
    // Runtime overrides (NUXT_*) are not applied to the config at build setup
    strapi: {
      strapiUrl: process.env.NUXT_PUBLIC_STRAPI_URL || String(nuxt.options.runtimeConfig.public.strapiUrl || ''),
      strapiApiToken: process.env.NUXT_STRAPI_API_TOKEN || String(nuxt.options.runtimeConfig.strapiApiToken || ''),
    },
    core: coreVersion(nuxt.options.rootDir),
    warn: (event, message, cause) => logger.warn(`${event}: ${message}${cause ? ` (${cause})` : ''}`),
  })
  const { identity } = theme
  adoptResolvedTheme(dir, index, theme)
  logger.info(`Theme of the site: ${identity.id}${identity.version ? `@${identity.version}` : ''} (${theme.source}), published at /_t/${identity.digest}/`)
  return theme
}

/** Writes what the build resolved to `/_micelio.json` once the pages are generated. */
function auditResolvedTheme(nuxt: ThemeContext['nuxt'], { identity, source }: StaticTheme): void {
  nuxt.hook('nitro:init', (nitro) => {
    nitro.hooks.hook('prerender:done', async () => {
      const theme = { id: identity.id, version: identity.version ?? null, digest: identity.digest, packageDigest: identity.packageDigest, source }
      await writeFile(join(nitro.options.output.publicDir, STATIC_AUDIT_PATH), `${JSON.stringify({ theme })}\n`)
    })
  })
}

/**
 * A static site has no server to answer `/_t/<digest>/…`, so the files of the theme the build rendered with are published as plain assets at that URL
 * (`copyPublishedFiles` says which).
 */
function exposeStatically(nuxt: ThemeContext['nuxt'], dir: string, digest: string): void {
  const files = copyPublishedFiles(dir, digest)
  ;(nuxt.options.nitro.publicAssets ||= []).push({ dir: files, baseURL: `${SERVE_PREFIX}/${digest}`, maxAge: 60 * 60 * 24 * 365 })
}

/**
 * Development: a saved change in a theme's folder installs it again, updates the index the server watches, and reloads the page.
 * A saved change to a layout variant's CSS (`app/theme/layout/`) installs every theme again, since each entry carries the CSS of its variants.
 * A theme that does not validate yet (the author is mid-edit) is reported and the last good entry stays.
 */
function reloadOnEdit(ctx: ThemeContext, install: (themeDir: string, id: string) => Promise<void>, writeIndex: () => void, layoutEdited: () => Promise<boolean>): void {
  const { nuxt } = ctx
  let vite: { ws: { send: (message: { type: 'full-reload' }) => void } } | undefined
  nuxt.hook('vite:serverCreated', (server, env) => {
    if (env.isClient) vite = server
  })
  nuxt.hook('builder:watch', async (_event, path) => {
    try {
      if (isLayoutCss(ctx, path)) {
        if (await layoutEdited()) {
          writeIndex()
          vite?.ws.send({ type: 'full-reload' })
        }
        return
      }
      if (!isThemePath(ctx, path)) return
      const abs = [resolve(nuxt.options.srcDir, path), resolve(nuxt.options.rootDir, path)]
      const theme = discoverThemes(ctx.roots).find(found => abs.some(file => file.startsWith(found.dir + sep)))
      if (!theme) return
      await install(theme.dir, theme.id)
      writeIndex()
      vite?.ws.send({ type: 'full-reload' })
    } catch (error) {
      useLogger('micelio-theme').error((error as Error).message)
    }
  })
}

/** True for a variant's stylesheet under `app/theme/layout/`. */
function isLayoutCss(ctx: ThemeContext, path: string): boolean {
  const root = join(ctx.nuxt.options.srcDir, 'theme/layout') + sep
  return path.endsWith('.css') && [resolve(ctx.nuxt.options.srcDir, path), resolve(ctx.nuxt.options.rootDir, path)].some(file => file.startsWith(root))
}
