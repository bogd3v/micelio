// Fails when a theme primitive (a token that is not a semantic role) is used outside assets/css/settings/.
// Roles: ADR 0005, section 1. Run by `npm run lint`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { delimiter, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCANNED = ['app', 'modules', 'themes']
const EXTENSIONS = /\.(css|vue|ts|mjs|mts)$/
const SETTINGS = 'app/assets/css/settings/'
// A theme package is where primitives belong (ADR 0005, section 1)
const THEMES = 'themes/'

// Contract v1 roles, plus the optional ones (link-soft, glow-link)
const ROLES = new Set([
  'surface', 'surface-raised', 'surface-sunken', 'line', 'line-strong', 'ink', 'ink-muted', 'on-ink',
  'accent', 'accent-soft', 'accent-hover', 'on-accent', 'link', 'link-soft', 'focus',
  ...['success', 'warning', 'danger', 'info'].flatMap(state => [state, `${state}-soft`]),
  ...[1, 2, 3, 4, 5, 6].flatMap(n => [`category-${n}`, `category-${n}-soft`]),
  'code-ink', 'code-muted', 'code-keyword', 'code-string', 'code-number', 'code-function',
  'glow-accent', 'glow-link', 'shadow-raised', 'shadow-overlay',
])

function primitives() {
  const names = themeFiles().flatMap((file) => {
    const tokens = JSON.parse(readFileSync(file, 'utf8'))
    return [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])].map(token => token.name)
  })
  return [...new Set(names)].filter(name => !ROLES.has(name))
}

// Every installed theme: themes/<id>/theme.json plus the directories in MICELIO_THEME_DIRS
function themeFiles() {
  const roots = [join(ROOT, 'themes'), ...(process.env.MICELIO_THEME_DIRS ?? '').split(delimiter).filter(Boolean).map(dir => resolve(ROOT, dir))]
  return roots.flatMap((root) => {
    if (!existsSync(root)) return []
    if (existsSync(join(root, 'theme.json'))) return [join(root, 'theme.json')]
    return readdirSync(root).map(name => join(root, name, 'theme.json')).filter(file => existsSync(file))
  })
}

function files(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : EXTENSIONS.test(name) ? [path] : []
  })
}

const names = primitives()
// var(--mirla), and utility-style names (text-mirla, bg-chillon-soft…) in case utilities come back
const pattern = new RegExp(`(?:--|\\b[a-z]+-)(${names.map(n => n.replace(/[-]/g, '\\-')).join('|')})(?![\\w-])`, 'g')
const problems = []
for (const path of SCANNED.flatMap(dir => files(join(ROOT, dir)))) {
  const file = relative(ROOT, path)
  if (file.startsWith(SETTINGS) || file.startsWith(THEMES)) continue
  readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
    for (const match of line.matchAll(pattern)) {
      problems.push(`${file}:${index + 1}  ${match[1]} is a theme primitive: use a semantic role (ADR 0005)`)
    }
  })
}
if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} primitive(s) outside ${SETTINGS} and ${THEMES}`)
  process.exitCode = 1
} else {
  console.log(`No theme primitives outside ${SETTINGS} and ${THEMES} (${names.length} primitives checked)`)
}
