import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addTypeTemplate, useLogger } from 'nuxt/kit'
import { loadHooks } from './hooks'
import { BUILT_IN_INDEX, BUILT_IN_STORE_PATH } from './install/constants'
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
 * development and next to its entry in production. Nothing else reads it yet: the pages still use the build-time modules.
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
  for (const theme of discoverThemes(ctx.roots)) {
    const result = await installTheme({ kind: 'folder', dir: theme.dir }, { storeDir: dir, hooks, coreBuild: index.coreBuild, allowCode: true, buildChecksOnly: true })
    for (const warning of result.warnings) useLogger('micelio-theme').warn(`Theme "${theme.id}": ${warning}`)
    index.themes[theme.id] = { digest: result.digest, version: result.manifest.version, code: result.manifest.code }
  }
  writeFileSync(join(dir, BUILT_IN_INDEX), JSON.stringify(index))
  nuxt.hook('nitro:init', (nitro) => {
    nitro.hooks.hook('compiled', (compiled) => {
      cpSync(dir, join(compiled.options.output.serverDir, BUILT_IN_STORE_PATH), { recursive: true })
    })
  })
}
