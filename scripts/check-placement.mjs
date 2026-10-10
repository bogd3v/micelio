// Fails when a type or constant declared outside the shared places is used by two or more files (imported or auto-imported), or when a shared file holds logic.
// Placement rules: engineering standard, section 4 ("Where types and constants live"). Run by `npm run lint`.
// With --strict (as `npm run lint` runs it) any problem exits 1; without it the script only reports.
// A file that uses an exported value of an auto-imported folder without importing it counts as an importer too:
// Nitro auto-imports server/utils/** into server/, Nuxt auto-imports app/composables/** and app/utils/** into app/.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCANNED = ['app', 'server', 'modules']
const STRICT = process.argv.includes('--strict')
// `file:name` → reason. A reason is mandatory: an entry without one is reported
const EXEMPT = new Map([
  ['modules/theme/specimen/fixtures.ts:POSTS', 'built with the `post()` builder that ARTICLE also uses and with the `Category` enum, which a shared file may not import at runtime; a literal copy would duplicate the post shape'],
  ['modules/theme/specimen/fixtures.ts:FEATURED_POST', 'the first of POSTS (see above)'],
])

const SOURCE = /\.(ts|mts|mjs|vue)$/
const RESOLVE_EXTENSIONS = ['', '.ts', '.mts', '.mjs', '.vue', '/index.ts', '/index.mjs']

// Auto-imported folders (no `imports.dirs` in nuxt.config.ts) and the side of the project that sees them
// Nitro scans server/utils/** recursively; Nuxt only the top level of each folder and `<dir>/index`
const AUTO_IMPORTS = [
  { scope: 'server/', matches: file => file.startsWith('server/utils/') },
  { scope: 'app/', matches: file => /^app\/(?:composables|utils)\/(?:[^/]+|[^/]+\/index\.\w+)$/.test(file) },
]

// An initializer that is a function or a call is logic, not a constant (`defineCachedFunction(…)`, arrows, `function`)
function isFunctionValued(initializer) {
  const text = initializer.trimStart()
  if (/^(?:async\b|function\b)/.test(text)) return true
  if (/^(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/.test(text)) return true
  return /^[A-Za-z_$][\w$.]*\s*\(/.test(text) && !text.startsWith('new ')
}

// The code of the bound attributes (`:a`, `v-*`, `@e`, `#slot`) of a .vue template, whose string values stripNoise would blank
function boundAttributes(source) {
  const start = source.indexOf('<template')
  const end = source.lastIndexOf('</template>')
  if (start < 0 || end < start) return ''
  const attribute = /\s(?::[\w.:-]+|v-[\w.:-]+|@[\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  return [...source.slice(start, end).matchAll(attribute)].map(match => ` ${stripNoise(match[1] ?? match[2])} `).join('')
}

// Whether `source` (already stripped) uses `name` as a value: not shadowed by a local binding and not only an object key
function usesName(source, name) {
  const escaped = name.replace(/\$/g, '\\$')
  if (new RegExp(`\\b(?:const|let|var|function|class|enum)\\s+${escaped}(?![\\w$])`).test(source)) return false
  if (new RegExp(`\\b(?:const|let|var)\\s*[{[][^=;]*(?<![\\w$.])${escaped}(?![\\w$])`).test(source)) return false
  const word = new RegExp(`(?<![\\w$.])${escaped}(?![\\w$])`, 'g')
  for (const match of source.matchAll(word)) {
    const before = source.slice(0, match.index).trimEnd()
    const isKey = /^\s*:(?!:)/.test(source.slice(match.index + name.length)) && !before.endsWith('?')
    if (!isKey) return true
  }
  return false
}

function files(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : SOURCE.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

// Shared places: the domain folders and the types.ts / constants.ts of a feature folder
// A plain-node script cannot import a .ts file, and a `constants.mjs` beside `constants.ts` would make `./constants` ambiguous: that folder's role lists live in roles.mjs
function isShared(file) {
  return file.startsWith('app/interfaces/') || file.startsWith('app/constants/') || /(^|\/)(?:types|constants)\.ts$/.test(file) || file === 'modules/theme/roles.mjs'
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

// Source with comments and string contents blanked, so a name mentioned in a comment or a message is not a use.
// The expressions inside `${…}` of a template literal are kept: they are code.
function stripNoise(source) {
  const noise = /\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g
  return source.replace(noise, (match) => {
    if (!match.startsWith('`')) return ' '
    return [...match.matchAll(/\$\{([^}]*)\}/g)].map(part => ` ${part[1]} `).join('')
  })
}

/**
 * Every placement problem of the sources under `root`, as sorted messages.
 * Exported for the unit test.
 */
export function findProblems(root = REPO_ROOT, exempt = root === REPO_ROOT ? EXEMPT : new Map()) {
  const sources = new Map(SCANNED.flatMap(dir => files(join(root, dir))).map(path => [relative(root, path), readFileSync(path, 'utf8')]))

  // Declarations: `export interface|type|const|enum Name`, with the kind
  const declarations = []
  for (const [file, source] of sources) {
    // server/schemas/ is already the shared home of the zod validators, which are logic, not constants
    if (isShared(file) || file.startsWith('server/schemas/')) continue
    for (const match of source.matchAll(/^export\s+(?:declare\s+)?(interface|type|const|enum)\s+([A-Za-z0-9_$]+)([^\n]*(?:\n[^\n]*)?)/gm)) {
      const [, kind, name, rest] = match
      const initializer = rest.includes('=') ? rest.slice(rest.indexOf('=') + 1) : ''
      if (kind === 'const' && isFunctionValued(initializer)) continue
      declarations.push({ file, kind, name })
    }
  }

  // Importers: file → declaring file → imported names. `export … from` re-exports are not usage
  const importers = new Map()
  // Local names a file imports from anything but a `#` alias: a name bound this way is not the auto-imported one
  const boundByImport = new Map()
  for (const [file, source] of sources) {
    for (const [, clause, specifier] of source.matchAll(/^import\s+(?:type\s+)?([^'"]*?)\s*from\s*['"]([^'"]+)['"]/gms)) {
      const target = resolveSpecifier(root, specifier, file)
      if (!specifier.startsWith('#')) {
        if (!boundByImport.has(file)) boundByImport.set(file, new Map())
        for (const part of clause.replace(/[{}]/g, ',').split(',')) {
          const local = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim()
          if (local) boundByImport.get(file).set(local, target)
        }
      }
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

  // Auto-import users: files of the matching side that mention a value of an auto-imported folder without importing it
  const stripped = new Map()
  const autoUsers = new Map()
  for (const { matches, scope } of AUTO_IMPORTS) {
    for (const { file, kind, name } of declarations) {
      if (kind === 'interface' || kind === 'type' || !matches(file)) continue
      for (const [other, source] of sources) {
        if (other === file || !other.startsWith(scope) || importers.get(`${file}\0${name}`)?.has(other)) continue
        const bound = boundByImport.get(other)?.get(name)
        if (bound !== undefined && bound !== file) continue
        if (!stripped.has(other)) stripped.set(other, stripNoise(source) + (other.endsWith('.vue') ? boundAttributes(source) : ''))
        if (!usesName(stripped.get(other), name)) continue
        const key = `${file}\0${name}`
        if (!autoUsers.has(key)) autoUsers.set(key, new Set())
        autoUsers.get(key).add(other)
      }
    }
  }

  const problems = []
  const honoured = new Set()
  for (const { file, kind, name } of declarations) {
    const users = [...new Set([...(importers.get(`${file}\0${name}`) ?? []), ...(autoUsers.get(`${file}\0${name}`) ?? [])])]
    if (users.length < 2) continue
    if (exempt.has(`${file}:${name}`)) {
      honoured.add(`${file}:${name}`)
      continue
    }
    const noun = kind === 'interface' || kind === 'type' ? 'type' : 'constant'
    problems.push(`${file}  ${noun} ${name} is used by ${users.length} files (${users.slice(0, 3).join(', ')}${users.length > 3 ? ', …' : ''}): move it to its domain file or its feature folder's ${noun === 'type' ? 'types.ts' : 'constants.ts'}`)
  }

  // A shared file holds declarations only: no logic and no runtime imports
  for (const [file, source] of sources) {
    if (!isShared(file)) continue
    for (const [, specifier] of source.matchAll(/^import\s+(?!type\b)[^'"]*from\s*['"]([^'"]+)['"]/gm)) problems.push(`${file}  runtime import of ${specifier}: a shared file holds declarations only (use import type)`)
    if (/^export\s+(?:async\s+)?(?:function|class)\b/m.test(source)) problems.push(`${file}  holds a function or class: a shared file holds declarations only`)
  }

  for (const [key, reason] of exempt) {
    if (!reason) problems.push(`${key}  exempt without a reason`)
    if (!honoured.has(key)) problems.push(`${key}  exempt entry is stale: the declaration moved, is gone or has fewer than 2 users (remove it)`)
  }

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
