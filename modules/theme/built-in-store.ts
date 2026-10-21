import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { addTypeTemplate, useLogger } from 'nuxt/kit'
import { isThemePath } from './context'
import { loadHooks } from './hooks'
import { BUILT_IN_INDEX, BUILT_IN_STORE_PATH, SERVE_PREFIX, STORE_DIR } from './install/constants'
import { installTheme } from './install/install'
import type { BuiltInIndex } from './install/types'
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
 * and were validated by `createContext`. Each is compiled for this build (`coreBuild` is the Nuxt build id), code themes included,
 * since their slots are compiled into the same build. The store lives under `node_modules/.cache/micelio/built-in-store/<build id>/`, is rebuilt on every
 * start, folders older than an hour are removed, and a production build copies it to `.output/server/micelio/store`. The server finds it by `#micelio/built-in-store` in
 * development and next to its entry in production. A static build also publishes the build theme's files at `/_t/<digest>/`, and
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
  const index: BuiltInIndex = { coreBuild: nuxt.options.buildId, buildTheme: ctx.id, themes: {} }
  for (const old of existsSync(cache) ? readdirSync(cache) : []) {
    if (Date.now() - statSync(join(cache, old)).mtimeMs > STALE_STORE_MS) rmSync(join(cache, old), { recursive: true, force: true })
  }
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })

  async function install(themeDir: string, id: string): Promise<void> {
    const result = await installTheme({ kind: 'folder', dir: themeDir }, { storeDir: dir, hooks, coreBuild: index.coreBuild, allowCode: true, buildChecksOnly: true })
    for (const warning of result.warnings) useLogger('micelio-theme').warn(`Theme "${id}": ${warning}`)
    index.themes[id] = { digest: result.digest, version: result.manifest.version, code: result.manifest.code }
  }
  for (const theme of discoverThemes(ctx.roots)) await install(theme.dir, theme.id)
  writeFileSync(join(dir, BUILT_IN_INDEX), JSON.stringify(index))

  if (nuxt.options.nitro.static) exposeStatically(nuxt, dir, index.themes[ctx.id]!.digest)
  if (nuxt.options.dev) {
    // The dev server reads the cache folder itself, which is the one an edit updates; a copy next to its entry would shadow it
    reloadOnEdit(ctx, install, () => writeFileSync(join(dir, BUILT_IN_INDEX), JSON.stringify(index)))
    return
  }
  nuxt.hook('nitro:init', (nitro) => {
    nitro.hooks.hook('compiled', (compiled) => {
      cpSync(dir, join(compiled.options.output.serverDir, BUILT_IN_STORE_PATH), { recursive: true })
    })
  })
}

/**
 * A static site has no server to answer `/_t/<digest>/…`, so the files of the build's theme are published as plain assets at that URL.
 * The precompressed copies, the manifest and `runtime.json` stay out: the host and Nitro's own compression do the first, the others are for the server, and a static page has no script to read them.
 */
function exposeStatically(nuxt: ThemeContext['nuxt'], dir: string, digest: string): void {
  const files = join(dir, 'published', digest)
  cpSync(join(dir, STORE_DIR, 'entries', digest), files, { recursive: true, filter: source => !/(\.(gz|br)|manifest\.json|runtime\.json)$/.test(source) })
  ;(nuxt.options.nitro.publicAssets ||= []).push({ dir: files, baseURL: `${SERVE_PREFIX}/${digest}`, maxAge: 60 * 60 * 24 * 365 })
}

/**
 * Development: a saved change in a theme's folder installs it again, updates the index the server watches, and reloads the page.
 * A theme that does not validate yet (the author is mid-edit) is reported and the last good entry stays.
 */
function reloadOnEdit(ctx: ThemeContext, install: (themeDir: string, id: string) => Promise<void>, writeIndex: () => void): void {
  const { nuxt } = ctx
  let vite: { ws: { send: (message: { type: 'full-reload' }) => void } } | undefined
  nuxt.hook('vite:serverCreated', (server, env) => {
    if (env.isClient) vite = server
  })
  nuxt.hook('builder:watch', async (_event, path) => {
    if (!isThemePath(ctx, path)) return
    try {
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
