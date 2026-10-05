import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { relative, sep } from 'node:path'

/** The text of a file of the theme, or a problem when it is a symlink or resolves outside the theme folder (the images code rejects symlinks the same way). */
export function readThemeFile(themeDir: string, path: string): { text: string } | { problem: string } {
  const name = relative(themeDir, path)
  if (lstatSync(path).isSymbolicLink()) return { problem: `${name} is a symlink; copy the file instead` }
  const root = realpathSync(themeDir)
  const real = realpathSync(path)
  if (real !== root && !real.startsWith(root + sep)) return { problem: `${name} resolves outside the theme folder` }
  return { text: readFileSync(path, 'utf8') }
}
