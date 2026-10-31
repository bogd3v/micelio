import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { BUILT_WORKER } from './constants'

/**
 * Builds the install worker of a production server: `worker.mjs` in `<serverDir>/micelio/`, with the native `lightningcss` beside it (ADR 0009, section 2).
 *
 * @remarks
 * `installIsolated` forks a script in a child process. The TypeScript worker loads only through jiti, which the runtime image does not have, so the
 * build bundles it with everything it imports except the native Lightning CSS binary, which is copied into `<serverDir>/node_modules/` (Nitro
 * traces only what the server itself imports, and it imports neither). The child process starts with an empty environment and nothing from a package is
 * ever imported into it.
 *
 * @param rootDir - The project, whose `node_modules` holds `lightningcss` and its platform package.
 * @param serverDir - `.output/server`.
 */
export async function buildInstallWorker(rootDir: string, serverDir: string): Promise<void> {
  await build({
    configFile: false,
    logLevel: 'warn',
    root: rootDir,
    ssr: { noExternal: true, target: 'node' },
    build: {
      ssr: fileURLToPath(new URL('./worker.ts', import.meta.url)),
      outDir: join(serverDir, 'micelio'),
      emptyOutDir: false,
      target: 'node22',
      minify: false,
      sourcemap: false,
      rollupOptions: { external: ['lightningcss'], output: { format: 'es', entryFileNames: BUILT_WORKER, codeSplitting: false } },
    },
  })
  const modules = join(rootDir, 'node_modules')
  const target = join(serverDir, 'node_modules')
  mkdirSync(target, { recursive: true })
  for (const name of readdirSync(modules).filter(found => found === 'lightningcss' || found.startsWith('lightningcss-'))) {
    if (!existsSync(join(target, name))) cpSync(join(modules, name), join(target, name), { recursive: true })
  }
}
