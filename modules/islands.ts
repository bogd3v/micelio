import { existsSync, readdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { build } from 'vite'
import { addTemplate, defineNuxtModule, useLogger } from 'nuxt/kit'
import { ISLANDS_PATH } from '../app/helpers/islands'
import type { IslandManifest } from '../app/helpers/islands'
import { isStaticMode } from '../app/helpers/siteMode'
import type { SiteMode } from '../app/helpers/siteMode'

// Islands (ADR 0006, section 3): `app/islands/<id>.ts` are custom elements built on their own, with a hashed file name,
// served from /_islands/ and added to a page with `useIsland(id)`. Only static builds have islands today; the dynamic build is untouched.
// Source edits need a restart in `nuxt dev`.
export default defineNuxtModule({
  meta: { name: 'micelio-islands' },
  async setup(_options, nuxt) {
    const mode = nuxt.options.runtimeConfig.public.siteMode as SiteMode
    const sourceDir = join(nuxt.options.srcDir, 'islands')
    const manifest: Record<string, string> = {}

    // `nuxt prepare` (npm ci's postinstall) builds nothing, and .nuxt/tsconfig.app.json does not exist yet for Vite
    if (isStaticMode(mode) && !nuxt.options._prepare && existsSync(sourceDir)) {
      // Not buildDir (Nuxt empties it before it builds); one folder per process, so two builds never write the same files
      const outDir = join(nuxt.options.rootDir, 'node_modules', '.cache', 'micelio', `islands-${process.pid}`)
      nuxt.hook('close', () => rm(outDir, { recursive: true, force: true }))
      const input = Object.fromEntries(
        readdirSync(sourceDir)
          .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'))
          .map(file => [parse(file).name, join(sourceDir, file)]),
      )
      if (Object.keys(input).length) {
        const result = await build({
          root: nuxt.options.rootDir,
          configFile: false,
          logLevel: 'warn',
          publicDir: false,
          build: {
            outDir,
            emptyOutDir: true,
            write: true,
            copyPublicDir: false,
            // cssTarget is the site's browser list (nuxt.config.ts, CSS_TARGETS) in esbuild syntax, which is also what Vite wants here
            target: nuxt.options.vite.build?.cssTarget ?? 'es2022',
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
        useLogger('micelio').info(`Islands: ${Object.values(manifest).join(', ')}`)

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
