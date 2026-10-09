import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, delimiter, join, resolve } from 'node:path'
import { FONT_FILE, themeIdProblem } from './contract'
import type { InstalledTheme, ThemeManifest } from './types'

export const DEFAULT_THEME = 'bogota'

function isThemeDir(dir: string): boolean {
  return existsSync(join(dir, 'theme.json'))
}

/** The directories to scan: `<root>/themes` plus `MICELIO_THEME_DIRS` (separated like PATH). */
export function themeRoots(rootDir: string, extra: string | undefined = process.env.MICELIO_THEME_DIRS): string[] {
  return [join(rootDir, 'themes'), ...(extra ?? '').split(delimiter).filter(Boolean).map(dir => resolve(rootDir, dir))]
}

/** Every theme found: a root's subfolders with a `theme.json`, or the root itself when it is a theme. */
export function discoverThemes(roots: string[]): InstalledTheme[] {
  const dirs = roots.flatMap((root) => {
    if (!existsSync(root)) return []
    if (isThemeDir(root)) return [root]
    return readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(root, entry.name)).filter(isThemeDir)
  })
  const themes = dirs.map(loadTheme)
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
    throw new Error(`NUXT_PUBLIC_THEME is "${id}" but that theme is not installed (installed: ${installed}). Add it to themes/ or to a directory in MICELIO_THEME_DIRS.`)
  }
  return found
}
