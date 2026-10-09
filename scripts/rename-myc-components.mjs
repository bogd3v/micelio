// One-off for #421 (epic #408, P6): renames the `Bd*` design-system components to `Myc*` (`app/components/bd/` →
// `app/components/myc/`) and the `bd.*` i18n namespace to `myc.*`. One to one, nothing else changes. Removed in #422 (P7).
// Run from the repo root on the tree of `main`: node scripts/rename-myc-components.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const SKIP = /^(docs\/adr\/|docs\/coverage\/|docs\/performance\.md$|package-lock\.json$|scripts\/rename-myc-)/
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(f => f && !SKIP.test(f))

let changed = 0
for (const file of files) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue // listed by git but deleted or moved in the working tree
  }
  if (text.includes('\0')) continue
  const next = text
    .replaceAll('components/bd/', 'components/myc/')
    .replace(/(\b|Lazy)Bd([A-Z])/g, '$1Myc$2')
    .replace(/(['"`]|keypath=")bd\./g, '$1myc.')
    .replace(/^ {2}"bd": \{/m, file.startsWith('i18n/locales/') ? '  "myc": {' : '$&')
  if (next !== text) {
    writeFileSync(file, next)
    changed++
  }
}
console.log(`${changed} files changed`)
