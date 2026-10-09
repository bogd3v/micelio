// Fails when a template uses a class that is not a core class: `bd-*` or one of the core helpers below (a theme may also use `<id>-*`).
// Keeps Tailwind-style utilities (p-4, text-sm, hover:…, [arbitrary]) out of app/, modules/ and themes/ (ADR 0005, section 3). Run by `npm run lint`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// Core helpers in assets/css that predate the bd- prefix
const ALLOWED = new Set(['font-display', 'font-mono', 'not-prose'])

function files(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.(vue|ts)$/.test(name) ? [path] : []
  })
}

// Class names a file sets: static class="…", string literals in :class="…", and class="…" inside TS strings
function classNames(source, file) {
  const template = file.endsWith('.vue') ? (source.split('<template>')[1] ?? '') : source
  const found = []
  for (const [, value] of template.matchAll(/(?<![\w:-])class="([^"]*)"/g)) found.push(...value.split(/\s+/))
  for (const [, binding] of template.matchAll(/:class="([^"]*)"/g)) {
    for (const match of binding.matchAll(/'([^']*)'/g)) {
      // A value being compared (status === 'error') is not a class name
      if (/[=!]=\s*$/.test(binding.slice(0, match.index))) continue
      found.push(...match[1].split(/\s+/))
    }
  }
  return found.filter(name => name && !name.includes('${') && !name.includes('{{'))
}

// A theme's own classes use its id as prefix (ADR 0005, section 5): themes/<id>/... may use `<id>-*`
function themePrefix(file) {
  const match = /^themes\/([^/]+)\//.exec(file)
  return match ? `${match[1]}-` : null
}

const problems = []
for (const path of ['app', 'modules', 'themes'].flatMap(dir => files(join(ROOT, dir)))) {
  const file = relative(ROOT, path)
  for (const name of classNames(readFileSync(path, 'utf8'), file)) {
    const prefix = themePrefix(file)
    if (!name.startsWith('bd-') && !ALLOWED.has(name) && !(prefix && name.startsWith(prefix))) problems.push(`${file}  "${name}" is not a core class: add a bd-* class in its layer (AGENTS.md, CSS Architecture)`)
  }
}
if (problems.length) {
  console.error([...new Set(problems)].join('\n'))
  console.error(`\n${problems.length} class(es) that are not bd-* or a core helper`)
  process.exitCode = 1
} else {
  console.log('Every template class is a bd-* class or a core helper')
}
