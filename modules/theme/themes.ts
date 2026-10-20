import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, delimiter, join, normalize, resolve, sep } from 'node:path'
import { FONT_FILE, themeIdProblem } from './contract'
import { PULLED_THEMES_DIR } from './registry/constants'
import type { InstalledTheme, ThemeManifest } from './types'

/** The theme used when neither `NUXT_PUBLIC_THEME` nor the runtime config names one; when it is the one selected and is not installed, the build fails. */
export const DEFAULT_THEME = 'bogota'

function isThemeDir(dir: string): boolean {
  return existsSync(join(dir, 'theme.json'))
}

/** The directories to scan: `<root>/themes`, the themes `theme:pull` installed in `<root>/.micelio/themes`, then `MICELIO_THEME_DIRS` (separated like PATH). */
export function themeRoots(rootDir: string, extra: string | undefined = process.env.MICELIO_THEME_DIRS): string[] {
  return [join(rootDir, 'themes'), join(rootDir, PULLED_THEMES_DIR), ...(extra ?? '').split(delimiter).filter(Boolean).map(dir => resolve(rootDir, dir))]
}

function isPulledRoot(root: string): boolean {
  return normalize(root).split(sep).slice(-2).join('/') === PULLED_THEMES_DIR
}

/**
 * Every theme found: a root's subfolders with a `theme.json`, or the root itself when it is a theme.
 *
 * @remarks
 * A theme that is both pulled (`.micelio/themes/`, from the lock) and in another root is read from the other one, so a theme author
 * can work on a checkout, and a notice says so. With `CI=true` that is an error: a build must not use an unpinned theme by accident.
 *
 * @throws `Error` when a theme is installed twice, or is both local and locked in CI.
 */
export function discoverThemes(roots: string[]): InstalledTheme[] {
  const found = roots.flatMap((root) => {
    if (!existsSync(root)) return []
    const dirs = isThemeDir(root) ? [root] : readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => join(root, entry.name)).filter(isThemeDir)
    return dirs.map(dir => ({ theme: loadTheme(dir), pulled: isPulledRoot(root) }))
  })
  const local = new Map(found.filter(item => !item.pulled).map(item => [item.theme.id, item.theme.dir]))
  const themes = found.filter((item) => {
    const shadow = item.pulled ? local.get(item.theme.id) : undefined
    if (shadow === undefined) return true
    if (process.env.CI === 'true') throw new Error(`Theme "${item.theme.id}" is in themes.lock.json and also at ${shadow}: a CI build uses only the locked one. Remove one of them.`)
    console.warn(`Theme "${item.theme.id}" is in themes.lock.json and also at ${shadow}: using the local one.`)
    return false
  }).map(item => item.theme)
  const seen = new Map<string, string>()
  for (const theme of themes) {
    const first = seen.get(theme.id)
    if (first) throw new Error(`Theme "${theme.id}" is installed twice: ${first} and ${theme.dir}`)
    seen.set(theme.id, theme.dir)
  }
  return themes
}

function loadTheme(dir: string): InstalledTheme {
  const file = join(dir, 'theme.json')
  let manifest: ThemeManifest
  try {
    manifest = JSON.parse(readFileSync(file, 'utf8')) as ThemeManifest
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${(error as Error).message}`, { cause: error })
  }
  const idProblem = typeof manifest.id === 'string' ? themeIdProblem(manifest.id) : '"id" must be a string'
  if (idProblem) throw new Error(`${file}: ${idProblem}`)
  if (manifest.id !== basename(dir)) throw new Error(`${file}: "id" is "${manifest.id}" but the folder is "${basename(dir)}"`)
  for (const font of manifest.fonts ?? []) {
    if (typeof font.file !== 'string' || !FONT_FILE.test(font.file)) throw new Error(`${file}: font file "${font.file}" must match ${FONT_FILE}`)
  }
  return { id: manifest.id, dir, manifest }
}

/** The installed theme with this id, or an error that names the installed ones. */
export function selectTheme(themes: InstalledTheme[], id: string): InstalledTheme {
  const found = themes.find(theme => theme.id === id)
  if (!found) {
    const installed = themes.map(theme => theme.id).join(', ') || 'none'
    throw new Error(`NUXT_PUBLIC_THEME is "${id}" but that theme is not installed (installed: ${installed}). Add it to themes/ or to a directory in MICELIO_THEME_DIRS, or install it from the registry: npm run theme:add -- ${id}, then npm run theme:pull.`)
  }
  return found
}
