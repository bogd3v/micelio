import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// The files Pyodide loads at run time. Pyodide finds them by name next to each other (`indexURL`), so they are emitted unbundled
// into one folder whose name carries a hash of their content (the site serves /_islands/ as immutable).
const FILES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip'] as const
const VIRTUAL = 'virtual:micelio-pyodide'
const RESOLVED = `\0${VIRTUAL}`

interface Emitter {
  emitFile: (file: { type: 'asset', fileName: string, source: string | Uint8Array }) => string
}

export interface PyodideAssetsPlugin {
  name: string
  buildStart: () => void
  resolveId: (id: string) => string | undefined
  load: (id: string) => string | undefined
  generateBundle: (this: Emitter) => void
}

/**
 * Lock file of a Pyodide with no packages: Pyodide needs one to start, and the published one lists ~300 packages the playground
 * does not ship (docs/security.md, the Python runtime). Keeps `info`, which Pyodide checks against its own version.
 */
export function stripLockFile(lock: string): string {
  const parsed = JSON.parse(lock) as { info: unknown }
  return JSON.stringify({ info: parsed.info, packages: {} })
}

/** `virtual:micelio-pyodide` exports `PYODIDE_DIR`, the folder (next to the runtime chunks) that holds the files of the Pyodide package. */
export function pyodideAssets(): PyodideAssetsPlugin {
  let folder = ''
  let files: Array<[string, Uint8Array | string]> = []
  // Set when the bundle imports the virtual module: a Worker bundle that never loads Python must not carry 13 MB of it
  let used = false
  return {
    name: 'micelio-pyodide-assets',
    buildStart() {
      const root = dirname(createRequire(import.meta.url).resolve('pyodide/package.json'))
      used = false
      files = [
        ...FILES.map((name): [string, Uint8Array] => [name, readFileSync(join(root, name))]),
        ['pyodide-lock.json', stripLockFile(readFileSync(join(root, 'pyodide-lock.json'), 'utf8'))],
      ]
      const hash = createHash('sha256')
      for (const [name, source] of files) hash.update(`${name}\0`).update(source).update('\0')
      folder = `pyodide-${hash.digest('base64url').slice(0, 8)}`
    },
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : undefined
    },
    load(id) {
      if (id === RESOLVED) used = true
      return id === RESOLVED ? `export const PYODIDE_DIR = ${JSON.stringify(folder)}\n` : undefined
    },
    generateBundle() {
      if (!used) return
      for (const [name, source] of files) this.emitFile({ type: 'asset', fileName: `runtimes/${folder}/${name}`, source })
    },
  }
}

/**
 * Removes the `.gz` copies Nitro makes of the Pyodide files (every target browser takes brotli, and Nitro serves `.br` first), and in a
 * static build the `.br` too: static hosts and `scripts/static-serve.mjs` compress on their own and ignore them.
 */
export async function dropPyodideCopies(publicDir: string, keepBrotli: boolean): Promise<void> {
  const runtimes = join(publicDir, '_islands', 'runtimes')
  if (!existsSync(runtimes)) return
  for (const folder of readdirSync(runtimes, { withFileTypes: true })) {
    if (!folder.isDirectory() || !folder.name.startsWith('pyodide-')) continue
    for (const file of readdirSync(join(runtimes, folder.name))) {
      if (file.endsWith('.gz') || (!keepBrotli && file.endsWith('.br'))) await rm(join(runtimes, folder.name, file), { force: true })
    }
  }
}
