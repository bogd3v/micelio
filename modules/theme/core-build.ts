import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LayoutCss } from './install/types'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * The folders whose files decide the bytes of a compiled entry: the theme module and `app/helpers/`, which it imports (`color.ts`).
 *
 * @remarks
 * Exported for `test/themeCoreBuild.test.ts` and as the default of `coreBuildOf`. `test/themeCoreBuild.test.ts` follows the imports of the compiler and fails when one leaves these folders.
 *
 * @internal
 */
export const CORE_SOURCE_DIRS: string[] = [HERE, resolve(HERE, '../../app/helpers')]

/** Regular files under `dir` as paths with `/` separators, sorted, so the same tree always lists the same way. */
function listFiles(dir: string, prefix = ''): string[] {
  const found: string[] = []
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = `${prefix}${entry.name}`
    if (entry.isDirectory()) found.push(...listFiles(dir, `${path}/`))
    else if (entry.isFile()) found.push(path)
  }
  return found
}

/**
 * Identifies the core build that compiles the built-in themes: the same sources and layout CSS give the same id, any change to either a different one.
 *
 * @remarks
 * It is part of every entry's compile key and so of the `/_t/<digest>/` URLs the pages carry (ADR 0009, section 1). It hashes the compiler's sources
 * and the variant CSS the entries embed, not the Nuxt build id, which is random on every build and would change the HTML of every page between two
 * builds of one commit.
 *
 * @param layoutCss - The CSS of the layout variants, which each entry embeds.
 * @param sourceDirs - The folders whose files are hashed, by path relative to each folder.
 */
export function coreBuildOf(layoutCss: LayoutCss, sourceDirs: string[] = CORE_SOURCE_DIRS): string {
  const hash = createHash('sha256')
  sourceDirs.forEach((dir, position) => {
    for (const file of listFiles(dir)) hash.update(`${position}:${file}\0`).update(readFileSync(join(dir, file))).update('\0')
  })
  return hash.update(JSON.stringify(layoutCss)).digest('hex').slice(0, 16)
}
