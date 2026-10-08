import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, parse, relative } from 'node:path'
import { build } from 'vite'
import { addTemplate, defineNuxtModule, useLogger } from 'nuxt/kit'
import { ISLANDS_PATH } from '../app/helpers/islands'
import { HEAVY_ISLANDS, validateHeavyIslands } from '../app/islands/heavy'
import { sharedWithLoader } from './lib/islands-graph'
import type { BuiltChunk } from './lib/islands-graph'
import type { IslandManifest } from '../app/helpers/islands'

const STALE_MS = 7 * 24 * 60 * 60 * 1000
const TMP_STALE_MS = 60 * 60 * 1000

// What the cache keeps next to the built files: entry name -> file, and the source modules the build read
interface CachedBuild {
  files: Record<string, string>
  modules: string[]
  modulesHash: string
}

// Not islands: the heavy registry (data) and everything under lib/ (shared helpers the islands import)
function islandEntries(sourceDir: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(sourceDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && entry.name !== 'heavy.ts')
      .map(entry => [parse(entry.name).name, join(sourceDir, entry.name)]),
  )
}

function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
    .sort()
}

// Islands import from app/helpers and app/interfaces, so those count as sources; the lockfile pins Vite and every dependency
function sourcesHash(srcDir: string, rootDir: string, target: string, dev: boolean): string {
  const hash = createHash('sha256').update(`${target}\0${dev}`)
  const files = [
    ...filesIn(join(srcDir, 'islands')),
    ...filesIn(join(srcDir, 'helpers')),
    ...filesIn(join(srcDir, 'interfaces')),
    join(rootDir, 'package-lock.json'),
    join(rootDir, 'tsconfig.json'),
    join(rootDir, 'modules', 'islands.ts'),
  ]
  for (const file of files) {
    if (existsSync(file)) hash.update(`${relative(rootDir, file)}\0`).update(readFileSync(file)).update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

// Hash of the files the build read, wherever they live (an island can import from any folder of the project)
function modulesHash(rootDir: string, modules: string[]): string {
  const hash = createHash('sha256')
  for (const file of modules) hash.update(`${file}\0`).update(existsSync(join(rootDir, file)) ? readFileSync(join(rootDir, file)) : '').update('\0')
  return hash.digest('hex')
}

// Project files (not dependencies, not virtual modules) the chunks were built from, relative to the root
function projectModules(rootDir: string, ids: Iterable<string>): string[] {
  const modules = new Set<string>()
  for (const id of ids) {
    const path = id.split('?')[0]!
    if (!isAbsolute(path) || path.includes('\0') || path.includes('node_modules')) continue
    const file = relative(rootDir, path)
    if (!file.startsWith('..')) modules.add(file)
  }
  return [...modules].sort()
}

// Entries of other source hashes untouched for a week, and temp folders of a build that died; never the one in use
async function prune(cacheDir: string, keep: string): Promise<void> {
  for (const name of await readdir(cacheDir).catch(() => [])) {
    if (!name.startsWith('islands-') || name === `islands-${keep}` || name === `islands-${keep}.json`) continue
    const path = join(cacheDir, name)
    const info = await stat(path).catch(() => undefined)
    const limit = name.includes('.tmp-') ? TMP_STALE_MS : STALE_MS
    if (info && Date.now() - info.mtimeMs > limit) await rm(path, { recursive: true, force: true })
  }
}

// node_modules/.cache, or the system temp folder where the project is read-only
async function cacheFolder(rootDir: string): Promise<string> {
  const preferred = join(rootDir, 'node_modules', '.cache', 'micelio')
  try {
    await mkdir(preferred, { recursive: true })
    return preferred
  } catch (error) {
    if (!['EACCES', 'EPERM', 'EROFS'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
    const fallback = join(tmpdir(), 'micelio')
    await mkdir(fallback, { recursive: true })
    return fallback
  }
}

async function readCache(rootDir: string, outDir: string, manifestFile: string): Promise<CachedBuild | undefined> {
  if (!existsSync(outDir) || !existsSync(manifestFile)) return undefined
  try {
    const cached = JSON.parse(await readFile(manifestFile, 'utf8')) as CachedBuild
    const complete = Object.values(cached.files).every(file => existsSync(join(outDir, file)))
    return complete && cached.modulesHash === modulesHash(rootDir, cached.modules) ? cached : undefined
  } catch {
    return undefined
  }
}

// Vite's preload helper would be one shared chunk the entry imports, so a heavy island's chunks would load with its entry (the stray check of
// docs/performance.md). Modulepreload is off, so every importer gets its own copy of the one-line helper and the entry stays self-contained.
// Islands must not import CSS: the copy drops Vite's CSS dependency loading and `vite:preloadError`.
const PRELOAD_HELPER = '\0vite/preload-helper.js'
const OWN_HELPER = '\0micelio-islands/preload-helper:'
const inlinePreloadHelper = {
  name: 'micelio-islands-preload-helper',
  enforce: 'pre' as const,
  resolveId(id: string, importer?: string): string | undefined {
    return id === PRELOAD_HELPER ? `${OWN_HELPER}${importer ?? ''}` : undefined
  },
  load(id: string): string | undefined {
    return id.startsWith(OWN_HELPER) ? 'export const __vitePreload = load => load()' : undefined
  },
}

// Islands (ADR 0006, sections 3 and 6): `app/islands/<id>.ts` are custom elements built on their own, with a hashed file name,
// served from /_islands/ and added to a page with `useIsland(id)`. They are built in every mode, as a Vite build apart from the app's
// (which only gains the manifest), and cached by a hash of their sources. Source edits need a restart in `nuxt dev`.
export default defineNuxtModule({
  meta: { name: 'micelio-islands' },
  async setup(_options, nuxt) {
    const sourceDir = join(nuxt.options.srcDir, 'islands')
    const manifest: Record<string, string> = {}

    // `nuxt prepare` (npm ci's postinstall) builds nothing, and .nuxt/tsconfig.app.json does not exist yet for Vite
    if (!nuxt.options._prepare && existsSync(sourceDir)) {
      const input = islandEntries(sourceDir)
      const problems = [
        ...validateHeavyIslands(HEAVY_ISLANDS),
        ...HEAVY_ISLANDS.filter(island => !Object.hasOwn(input, island.entry)).map(island => `island "${island.id}": entry "${island.entry}" is not a file of app/islands/`),
      ]
      if (problems.length) throw new Error(`Invalid heavy island registry (app/islands/heavy.ts):\n- ${problems.join('\n- ')}`)

      if (Object.keys(input).length) {
        // cssTarget is the site's browser list (nuxt.config.ts, CSS_TARGETS) in esbuild syntax, which is also what Vite wants here
        const target = String(nuxt.options.vite.build?.cssTarget ?? 'es2022')
        const key = sourcesHash(nuxt.options.srcDir, nuxt.options.rootDir, target, nuxt.options.dev)
        // Not buildDir (Nuxt empties it before it builds)
        const cacheDir = await cacheFolder(nuxt.options.rootDir)
        const outDir = join(cacheDir, `islands-${key}`)
        const manifestFile = join(cacheDir, `islands-${key}.json`)
        const logger = useLogger('micelio')

        const cached = await readCache(nuxt.options.rootDir, outDir, manifestFile)
        if (cached) {
          Object.assign(manifest, cached.files)
          // A hit marks the entry as in use for the pruning done by other checkouts
          const now = new Date()
          await Promise.all([utimes(outDir, now, now), utimes(manifestFile, now, now)]).catch(() => {})
          logger.info(`Islands (cached ${key}): ${Object.values(manifest).join(', ')}`)
        } else {
          // Built into a folder of its own, then renamed, so two builds at once never write the same files
          const tmpDir = join(cacheDir, `islands-${key}.tmp-${process.pid}-${Date.now()}`)
          try {
            const result = await build({
              root: nuxt.options.rootDir,
              configFile: false,
              logLevel: 'warn',
              publicDir: false,
              define: { __MICELIO_DEV__: JSON.stringify(nuxt.options.dev) },
              plugins: [inlinePreloadHelper],
              build: {
                outDir: tmpDir,
                emptyOutDir: true,
                write: true,
                copyPublicDir: false,
                target,
                minify: true,
                sourcemap: false,
                modulePreload: false,
                rollupOptions: {
                  input,
                  preserveEntrySignatures: 'exports-only',
                  output: { format: 'es', entryFileNames: '[name]-[hash].js', chunkFileNames: 'chunks/[name]-[hash].js' },
                },
              },
            })
            const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => ('output' in item ? item.output : []))
            const ids = new Set<string>()
            const graph: BuiltChunk[] = []
            for (const chunk of outputs) {
              if (chunk.type !== 'chunk') continue
              graph.push({ fileName: chunk.fileName, name: chunk.name, isEntry: chunk.isEntry, imports: chunk.imports })
              if (chunk.isEntry) manifest[chunk.name] = chunk.fileName
              for (const id of chunk.moduleIds) ids.add(id)
            }
            const shared = sharedWithLoader(graph, HEAVY_ISLANDS.map(island => island.entry))
            if (shared.length) throw new Error(`Islands build:\n- ${shared.join('\n- ')}`)
            const modules = projectModules(nuxt.options.rootDir, ids)
            for (const island of HEAVY_ISLANDS) {
              if (!manifest[island.entry]) throw new Error(`Heavy island "${island.id}": entry "${island.entry}" was not built`)
            }
            // A stale folder (its manifest or files no longer match) is replaced; one that is there afterwards came from a build that won the race, with the same files
            if (existsSync(outDir)) await rm(outDir, { recursive: true, force: true })
            await rename(tmpDir, outDir).catch((error: unknown) => {
              if (!existsSync(outDir)) throw error
            })
            const manifestTmp = `${manifestFile}.tmp-${process.pid}-${Date.now()}`
            const record: CachedBuild = { files: manifest, modules, modulesHash: modulesHash(nuxt.options.rootDir, modules) }
            await writeFile(manifestTmp, JSON.stringify(record))
            await rename(manifestTmp, manifestFile)
          } finally {
            await rm(tmpDir, { recursive: true, force: true })
          }
          logger.info(`Islands (built ${key}): ${Object.values(manifest).join(', ')}`)
        }
        await prune(cacheDir, key)

        nuxt.hook('nitro:config', (config) => {
          config.publicAssets ||= []
          config.publicAssets.push({ dir: outDir, baseURL: ISLANDS_PATH.replace(/\/$/, ''), maxAge: 60 * 60 * 24 * 365 })
        })
      }
    }

    const typed: IslandManifest = manifest
    addTemplate({
      filename: 'micelio/islands.ts',
      write: true,
      getContents: () => `const manifest: Readonly<Record<string, string>> = ${JSON.stringify(typed)}\n\nexport default manifest\n`,
    })
  },
})
