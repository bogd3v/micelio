import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { THEME_ID, themeIdProblem } from './contract'

const STARTER_ID = 'starter'
const USAGE = 'Usage: npm run theme:new -- <id> [--name "Theme name"]'

export interface ThemeNewArgs {
  id: string
  name?: string
}

/** Parse the CLI arguments: exactly one id, optional `--name <value>` or `--name=<value>`; unknown flags are errors. */
export function parseThemeNewArgs(argv: string[]): ThemeNewArgs {
  let parsed: { positionals: string[], values: { name?: string } }
  try {
    parsed = parseArgs({ args: argv, options: { name: { type: 'string' } }, allowPositionals: true, strict: true })
  } catch (error) {
    throw new Error(`${(error as Error).message}\n${USAGE}`, { cause: error })
  }
  if (parsed.positionals.length !== 1) throw new Error(`Expected exactly one theme id, got ${parsed.positionals.length}.\n${USAGE}`)
  return { id: parsed.positionals[0]!, name: parsed.values.name }
}

/** Files whose `starter-` prefix is the theme's own: theme.css and slots/ (symlinks are skipped). */
function prefixedFiles(root: string): string[] {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name)
    if (entry.isSymbolicLink()) return []
    if (entry.isDirectory()) return walk(file)
    return /\.(css|vue)$/.test(entry.name) ? [file] : []
  })
  return walk(root).filter((file) => {
    const path = relative(root, file)
    return path === 'theme.css' || path.startsWith('slots/')
  })
}

function renameStarter(target: string, id: string, name: string): void {
  for (const file of prefixedFiles(target)) {
    const text = readFileSync(file, 'utf8')
    let next = text.replaceAll(`${STARTER_ID}-`, `${id}-`)
    if (file === join(target, 'theme.css')) next = next.replace(/^\/\* Starter:/, () => `/* ${name}:`)
    if (next !== text) writeFileSync(file, next)
  }
  const manifestFile = join(target, 'theme.json')
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<string, unknown>
  manifest.id = id
  manifest.name = name
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
}

/** Copy the starter theme to `target` and rename it to `id` (and optional `name`). Throws a clear message on bad input; a failed copy leaves nothing behind. */
export function scaffoldTheme(source: string, target: string, id: string, installed: string[], name: string = id): void {
  if (!THEME_ID.test(id)) throw new Error(`Invalid theme id "${id}": it must match ${THEME_ID} (lowercase letters, digits and hyphens).`)
  const idProblem = themeIdProblem(id)
  if (idProblem) throw new Error(`Invalid theme id "${id}": ${idProblem}.`)
  // eslint-disable-next-line no-control-regex
  if (!name.trim() || name.includes('*/') || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Invalid theme name: it must not be empty, contain "*/" or control characters.')
  if (installed.includes(id)) throw new Error(`Theme "${id}" is already installed (installed: ${installed.join(', ')}). Pick another id.`)
  if (existsSync(target)) throw new Error(`${target} already exists. Pick another id or remove it.`)
  try {
    cpSync(source, target, { recursive: true })
    renameStarter(target, id, name)
  } catch (error) {
    rmSync(target, { recursive: true, force: true })
    throw error
  }
}
