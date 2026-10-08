import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, parse, relative } from 'node:path'
import { build } from 'vite'
import { addTemplate, defineNuxtModule, useLogger } from 'nuxt/kit'
import { ISLANDS_PATH } from '../app/helpers/islands'
import type { IslandManifest } from '../app/helpers/islands'

const STALE_MS = 7 * 24 * 60 * 60 * 1000

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
function sourcesHash(srcDir: string, rootDir: string, target: string): string {
  const hash = createHash('sha256').update(target)
  const files = [
    ...filesIn(join(srcDir, 'islands')),
    ...filesIn(join(srcDir, 'helpers')),
    ...filesIn(join(srcDir, 'interfaces')),
    join(rootDir, 'package-lock.json'),
    join(rootDir, 'modules', 'islands.ts'),
  ]
  for (const file of files) {
    if (existsSync(file)) hash.update(`${relative(rootDir, file)}\0`).update(readFileSync(file)).update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

// Entries of other source hashes untouched for a week; a recent one may belong to another checkout or a running build
async function prune(cacheDir: string, keep: string): Promise<void> {
  for (const name of await readdir(cacheDir).catch(() => [])) {
    if (!name.startsWith('islands-') || name.startsWith(`islands-${keep}`)) continue
    const path = join(cacheDir, name)
    const info = await stat(path).catch(() => undefined)
    if (info && Date.now() - info.mtimeMs > STALE_MS) await rm(path, { recursive: true, force: true })
  }
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
      if (Object.keys(input).length) {
        // cssTarget is the site's browser list (nuxt.config.ts, CSS_TARGETS) in esbuild syntax, which is also what Vite wants here
        const target = String(nuxt.options.vite.build?.cssTarget ?? 'es2022')
        const key = sourcesHash(nuxt.options.srcDir, nuxt.options.rootDir, target)
        // Not buildDir (Nuxt empties it before it builds)
        const cacheDir = join(nuxt.options.rootDir, 'node_modules', '.cache', 'micelio')
        const outDir = join(cacheDir, `islands-${key}`)
        const manifestFile = join(cacheDir, `islands-${key}.json`)
        const logger = useLogger('micelio')

        if (existsSync(outDir) && existsSync(manifestFile)) {
          Object.assign(manifest, JSON.parse(await readFile(manifestFile, 'utf8')) as Record<string, string>)
          logger.info(`Islands (cached ${key}): ${Object.values(manifest).join(', ')}`)
        } else {
          // Built into a folder of its own, then renamed, so two builds at once never write the same files
          const tmpDir = join(cacheDir, `islands-${key}.tmp-${process.pid}-${Date.now()}`)
          await mkdir(cacheDir, { recursive: true })
          try {
            const result = await build({
              root: nuxt.options.rootDir,
              configFile: false,
              logLevel: 'warn',
              publicDir: false,
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
            for (const chunk of outputs) {
              if (chunk.type === 'chunk' && chunk.isEntry) manifest[chunk.name] = chunk.fileName
            }
            // If the folder already exists another build won the rename; same sources, same files
            await rename(tmpDir, outDir).catch((error: unknown) => {
              if (!existsSync(outDir)) throw error
            })
            const manifestTmp = `${manifestFile}.tmp-${process.pid}-${Date.now()}`
            await writeFile(manifestTmp, JSON.stringify(manifest))
            await rename(manifestTmp, manifestFile)
          } finally {
            await rm(tmpDir, { recursive: true, force: true })
          }
          logger.info(`Islands (built ${key}): ${Object.values(manifest).join(', ')}`)
          await prune(cacheDir, key)
        }

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
