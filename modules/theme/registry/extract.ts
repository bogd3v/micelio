import { mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { UnpackError } from './error'
import { pathProblem } from './paths'

/**
 * Writes unpacked files into a directory that must not exist yet, creating every file exclusively.
 *
 * @remarks
 * Paths are checked again and must resolve inside the new directory. The folder is `0700` and files `0600`: whoever installs
 * the theme decides what to publish. It does not clean up after a failure; the caller removes the folder.
 *
 * @param files - The `files` of `unpackTheme`.
 * @param target - A new directory; an existing one is an error (`EEXIST`).
 * @throws `UnpackError` for a path that breaks a rule, or the file system error.
 */
export function extractTheme(files: ReadonlyMap<string, Uint8Array>, target: string): void {
  mkdirSync(target, { mode: 0o700 })
  const root = realpathSync(target)
  for (const [path, data] of files) {
    const problem = pathProblem(path)
    if (problem) throw problem
    const file = join(root, ...path.split('/'))
    if (!file.startsWith(root + sep)) throw new UnpackError('path', 'resolves outside the target folder', path)
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    writeFileSync(file, data, { flag: 'wx', mode: 0o600 })
  }
}
