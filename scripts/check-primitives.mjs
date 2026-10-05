// Fails when a theme primitive (a token that is not a semantic role) is used outside assets/css/settings/.
// Roles: ADR 0005, section 1. Run by `npm run lint`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCANNED = ['app']
const EXTENSIONS = /\.(css|vue|ts|mjs)$/
const SETTINGS = 'app/assets/css/settings/'

// Contract v1 roles, plus the optional ones (link-soft, glow-link)
const ROLES = new Set([
  'surface', 'surface-raised', 'surface-sunken', 'line', 'line-strong', 'ink', 'ink-muted', 'on-ink',
  'accent', 'accent-soft', 'accent-hover', 'on-accent', 'link', 'link-soft', 'focus',
  ...['success', 'warning', 'danger', 'info'].flatMap(state => [state, `${state}-soft`]),
  ...[1, 2, 3, 4, 5, 6].flatMap(n => [`category-${n}`, `category-${n}-soft`]),
  'code-ink', 'code-muted', 'code-keyword', 'code-string', 'code-number', 'code-function',
  'glow-accent', 'glow-link',
])

// The logo is the ThemeMark slot; it moves into the theme package with #237 (F6)
const ALLOWED = { 'app/assets/css/components/logo.css': new Set(['logo-agua', 'logo-ladrillo']) }

function primitives() {
  const tokens = JSON.parse(readFileSync(join(ROOT, 'docs/design/tokens.json'), 'utf8'))
  return [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])].map(token => token.name).filter(name => !ROLES.has(name))
}

function files(dir) {
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
  if (file.startsWith(SETTINGS)) continue
  readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
    for (const match of line.matchAll(pattern)) {
      if (!ALLOWED[file]?.has(match[1])) problems.push(`${file}:${index + 1}  ${match[1]} is a theme primitive: use a semantic role (ADR 0005)`)
    }
  })
}
if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} primitive(s) outside ${SETTINGS}`)
  process.exitCode = 1
} else {
  console.log(`No theme primitives outside ${SETTINGS} (${names.length} primitives checked)`)
}
