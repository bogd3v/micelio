// Fails when a type or constant declared outside the shared places is imported by two or more files, or when a shared file holds logic.
// Placement rules: engineering standard, section 4 ("Where types and constants live"). Run by `npm run lint`.
// Without --strict it only reports and exits 0 (the check is introduced as a report, issue #423).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCANNED = ['app', 'server', 'modules']
const STRICT = process.argv.includes('--strict')
// `file:name` → reason. A reason is mandatory: an entry without one is reported
const EXEMPT = new Map([])

const SOURCE = /\.(ts|mts|mjs|vue)$/
const RESOLVE_EXTENSIONS = ['', '.ts', '.mts', '.mjs', '.vue', '/index.ts', '/index.mjs']

function files(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : SOURCE.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

// Shared places: the domain folders and the types.ts / constants.ts of a feature folder
function isShared(file) {
  return file.startsWith('app/interfaces/') || file.startsWith('app/constants/') || /(^|\/)(types|constants)\.ts$/.test(file)
}

// `~/x` is app/x and `~~/x` the project root; `#micelio/...` and `#build/...` are generated and never declare shared things
function resolveSpecifier(root, specifier, from) {
  let base
  if (specifier.startsWith('~~/')) base = join(root, specifier.slice(3))
  else if (specifier.startsWith('~/')) base = join(root, 'app', specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(join(root, from)), specifier)
  else return null
  for (const extension of RESOLVE_EXTENSIONS) {
    const candidate = base + extension
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(root, candidate)
  }
  return null
}

/**
 * Every placement problem of the sources under `root`, as sorted messages.
 * Exported for the unit test.
 */
export function findProblems(root = REPO_ROOT) {
  const sources = new Map(SCANNED.flatMap(dir => files(join(root, dir))).map(path => [relative(root, path), readFileSync(path, 'utf8')]))

  // Declarations: `export interface|type|const|enum Name`, with the kind
  const declarations = []
  for (const [file, source] of sources) {
    // server/schemas/ is already the shared home of the zod validators, which are logic, not constants
    if (isShared(file) || file.startsWith('server/schemas/')) continue
    for (const [, kind, name] of source.matchAll(/^export\s+(?:declare\s+)?(interface|type|const|enum)\s+([A-Za-z0-9_$]+)/gm)) declarations.push({ file, kind, name })
  }

  // Importers: file → declaring file → imported names. `export … from` re-exports are not usage
  const importers = new Map()
  for (const [file, source] of sources) {
    for (const [, clause, specifier] of source.matchAll(/^import\s+(?:type\s+)?([^'"]*?)\s*from\s*['"]([^'"]+)['"]/gms)) {
      const target = resolveSpecifier(root, specifier, file)
      if (!target || target === file) continue
      for (const part of clause.replace(/[{}]/g, ',').split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
        if (!name) continue
        const key = `${target}\0${name}`
        if (!importers.has(key)) importers.set(key, new Set())
        importers.get(key).add(file)
      }
    }
  }

  const problems = []
  for (const { file, kind, name } of declarations) {
    const users = [...(importers.get(`${file}\0${name}`) ?? [])]
    if (users.length < 2 || EXEMPT.has(`${file}:${name}`)) continue
    const noun = kind === 'interface' || kind === 'type' ? 'type' : 'constant'
    problems.push(`${file}  ${noun} ${name} is imported by ${users.length} files (${users.slice(0, 3).join(', ')}${users.length > 3 ? ', …' : ''}): move it to its domain file or its feature folder's ${noun === 'type' ? 'types.ts' : 'constants.ts'}`)
  }

  // A shared file holds declarations only: no logic and no runtime imports
  for (const [file, source] of sources) {
    if (!isShared(file)) continue
    for (const [, specifier] of source.matchAll(/^import\s+(?!type\b)[^'"]*from\s*['"]([^'"]+)['"]/gm)) problems.push(`${file}  runtime import of ${specifier}: a shared file holds declarations only (use import type)`)
    if (/^export\s+(?:async\s+)?(?:function|class)\b/m.test(source)) problems.push(`${file}  holds a function or class: a shared file holds declarations only`)
  }

  for (const [key, reason] of EXEMPT) if (!reason) problems.push(`${key}  exempt without a reason`)

  return [...new Set(problems)].sort()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = findProblems()
  if (problems.length) {
    console.error(problems.join('\n'))
    console.error(`\n${problems.length} placement problem(s)${STRICT ? '' : ' (report only: pass --strict to fail)'}`)
    if (STRICT) process.exitCode = 1
  } else {
    console.log('Every shared type and constant is in its shared place')
  }
}
