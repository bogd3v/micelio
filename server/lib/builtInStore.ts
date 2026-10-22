import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { BUILT_IN_INDEX, BUILT_IN_STORE_PATH, COMPILED_DIGEST } from '../../modules/theme/install/constants'
import { parseRuntime } from '../../modules/theme/install/runtime'
import { loadEntrySync } from '../../modules/theme/install/store'
import type { BuiltInIndex } from '../../modules/theme/install/types'
import type { BuiltInTheme } from './types'
import { THEME_DIGEST } from '../../modules/theme/registry/constants'
import { LAYOUT_REGIONS, THEME_ID } from '../../modules/theme/constants'

// The built-in store of the image (ADR 0009, section 1): the themes compiled at build, loaded and verified once at boot.

const Index: z.ZodType<BuiltInIndex> = z.strictObject({
  coreBuild: z.string().min(1).max(200),
  buildTheme: z.string().regex(THEME_ID),
  themes: z.record(z.string().regex(THEME_ID), z.strictObject({ digest: z.string().regex(COMPILED_DIGEST), version: z.string().max(128), code: z.boolean() })),
})

/**
 * The folder of the built-in store: next to the server entry in a production build, else the build's own cache folder.
 *
 * @remarks
 * Looks up, a few levels from each starting file, for `micelio/store/index.json` (`.output/server/micelio/store`), so it does not
 * matter in which chunk the bundler put the caller. Development and prerendering, which run before the copy, use `fallback`.
 * Nitro runs its plugins while the entry module is still loading, before `import.meta.url` names the entry, so the caller also
 * starts from the script node was run with.
 *
 * @param starts - Files to start from: `process.argv[1]` and the caller's own file. Empty strings are skipped.
 * @param fallback - The absolute folder the build wrote (`#micelio/built-in-store`).
 * @throws `Error` when neither holds a store: the image was built without one.
 */
export function locateBuiltInStore(starts: string[], fallback: string): string {
  for (const start of starts.filter(Boolean)) {
    let dir = dirname(start)
    for (let level = 0; level < 5; level++, dir = dirname(dir)) {
      const candidate = join(dir, BUILT_IN_STORE_PATH)
      if (existsSync(join(candidate, BUILT_IN_INDEX))) return candidate
    }
  }
  if (existsSync(join(fallback, BUILT_IN_INDEX))) return fallback
  throw new Error('The image has no built-in theme store: it was built without the theme module, or the store was removed')
}

function readIndex(storeDir: string): BuiltInIndex {
  return Index.parse(JSON.parse(readFileSync(join(storeDir, BUILT_IN_INDEX), 'utf8')))
}

/**
 * Loads the instance's default theme: `configured` (`NUXT_PUBLIC_THEME`), or the build's own theme when it is blank.
 *
 * @remarks
 * Slots and layout variants are compiled for the build's theme until #402, so another theme can stand in only when it ships no code,
 * the build's theme ships none either, and both use the same layout variants. A rule #402 deletes.
 *
 * @param configured - The runtime value of `NUXT_PUBLIC_THEME`; blanks count as unset.
 * @throws `Error` naming `NUXT_PUBLIC_THEME` when the theme is not in the store or cannot stand in for the build's theme.
 */
export function loadDefaultTheme(storeDir: string, configured: unknown): BuiltInTheme {
  const { buildTheme } = readIndex(storeDir)
  const id = typeof configured === 'string' ? configured.trim() : ''
  if (id === '' || id === buildTheme) return loadBuiltInTheme(storeDir, buildTheme)
  let theme: BuiltInTheme
  try {
    theme = loadBuiltInTheme(storeDir, id)
  } catch (error) {
    throw new Error(`NUXT_PUBLIC_THEME is "${id}": ${(error as Error).message}`, { cause: error })
  }
  const build = loadBuiltInTheme(storeDir, buildTheme)
  if (theme.runtime.code || build.runtime.code) {
    throw new Error(`NUXT_PUBLIC_THEME is "${id}" but this build was made for "${buildTheme}": a theme with code (slots) needs its own build until layouts and slots load at runtime. Rebuild with NUXT_PUBLIC_THEME=${id}.`)
  }
  if (LAYOUT_REGIONS.some(region => theme.runtime.layout[region] !== build.runtime.layout[region])) {
    throw new Error(`NUXT_PUBLIC_THEME is "${id}" but its layout variants differ from the ones this build, made for "${buildTheme}", carries. Rebuild with NUXT_PUBLIC_THEME=${id}.`)
  }
  return theme
}

/**
 * Loads and verifies the built-in theme `id` (the build's own when omitted), or throws a message that names the theme.
 *
 * @remarks
 * A built-in entry that fails its manifest or its schema is an image defect, so it stops the boot: there is nothing earlier to fall back to (#403 adds the last good theme).
 *
 * @throws `Error` when the theme is not in the store or its entry fails verification.
 */
export function loadBuiltInTheme(storeDir: string, id?: string): BuiltInTheme {
  const index = readIndex(storeDir)
  const wanted = id ?? index.buildTheme
  const listed = Object.hasOwn(index.themes, wanted) ? index.themes[wanted] : undefined
  if (listed === undefined) throw new Error(`Theme "${wanted}" is not in the built-in store; it holds: ${Object.keys(index.themes).join(', ')}`)
  const entry = loadEntrySync(storeDir, listed.digest)
  if (entry === null) throw new Error(`The built-in entry of theme "${wanted}" is missing from the store`)
  if (!THEME_DIGEST.test(entry.manifest.packageDigest)) throw new Error(`The built-in entry of theme "${wanted}" has a malformed package digest`)
  const file = entry.files.get('runtime.json')
  if (file === undefined) throw new Error(`The built-in entry of theme "${wanted}" has no runtime.json`)
  return { entry, runtime: parseRuntime(file, listed.digest) }
}

/**
 * Development: a function to call before each request that loads the theme again when the build rewrote the store's index.
 *
 * @remarks
 * The build installs a theme again when its folder changes and rewrites `index.json` (`modules/theme/built-in-store.ts`). An entry that
 * fails to load (the author is mid-edit) is reported and the theme the server had stays.
 *
 * @param load - Loads the theme again.
 * @param onChange - Receives the theme loaded after a change.
 * @param onError - Receives the error of an entry that could not be loaded; the caller logs it.
 */
export function watchBuiltInIndex(storeDir: string, load: () => BuiltInTheme, onChange: (theme: BuiltInTheme) => void, onError: (error: unknown) => void): () => void {
  const stamp = (): number => statSync(join(storeDir, BUILT_IN_INDEX)).mtimeMs
  let seen = stamp()
  return () => {
    const now = stamp()
    if (now === seen) return
    seen = now
    try {
      onChange(load())
    } catch (error) {
      onError(error)
    }
  }
}
