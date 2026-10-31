import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTRACT_VERSION } from '../constants'
import { COMPILER_VERSION, CSS_TARGETS, STORE_VERSION } from './constants'

// The compile key and the digest of an entry: what tells a server whether a store entry was compiled for this core. Apart from `compile.ts` so a server can
// read them without loading the compiler.

function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex')
}

/** `CSS_TARGETS` in the form Lightning CSS takes. */
export const LIGHTNINGCSS_TARGETS = Object.fromEntries(
  Object.entries(CSS_TARGETS).map(([browser, [major, minor = 0]]) => [browser, (major << 16) | (minor << 8)]),
)

/** The version of an installed package, read from its `package.json` beside this code (the repository, or `.output/server/node_modules`): it does not depend on how the package's entry points resolve. */
function packageVersion(name: string): string {
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    const file = join(dir, 'node_modules', name, 'package.json')
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as { version?: string }
      if (pkg.version) return pkg.version
    }
    if (dirname(dir) === dir) throw new Error(`cannot find the version of ${name}`)
  }
}

/**
 * Hash of everything besides the package that decides the compiled bytes: the compiler, the core build, Lightning CSS and the message compiler with their targets, and the contract.
 *
 * @param coreBuild - Identifies the core build; a different one gives a different key, so new URLs (ADR 0009, section 1).
 */
export function compileKey(coreBuild: string): string {
  return sha256(JSON.stringify({
    compiler: COMPILER_VERSION,
    store: STORE_VERSION,
    core: coreBuild,
    contract: CONTRACT_VERSION,
    lightningcss: packageVersion('lightningcss'),
    messageCompiler: packageVersion('@intlify/message-compiler'),
    targets: LIGHTNINGCSS_TARGETS,
  }))
}

/** The digest of a compiled entry: a hash of its inputs, so it is known before compiling and the CSS can name its own URLs. */
export function compiledDigest(packageDigest: string, key: string): string {
  return sha256(`${packageDigest}\n${key}`)
}
