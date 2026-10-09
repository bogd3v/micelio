// One-off for #419 (epic #408, P4): renames the cascade layers `bd.*` and the custom properties `--bd-*` to `myc.*` and `--myc-*`.
// One to one, nothing else changes. Removed in #421 (P6). Run from the repo root: node scripts/rename-myc-layers.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// Caution: also matches any other text spelled `bd.theme`, `bd.layout`… (an i18n key, for example); none existed when it ran
const LAYER = /\bbd\.(reset|settings|base|components|layout|pages|theme|animations|utilities)\b/g
const PROPERTY = /--bd-/g
// Decision records and the performance history say what was true when written, so they are not rewritten (ADR 0005, amendment of 2026-10-08)
const SKIP = /^(docs\/adr\/|docs\/performance\.md$|scripts\/rename-myc-layers\.mjs$)/

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(f => f && !SKIP.test(f))
let changed = 0
for (const file of files) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue // a tracked file that is not on disk (deleted, not staged)
  }
  if (text.includes('\0')) continue
  const next = text.replace(LAYER, 'myc.$1').replace(PROPERTY, '--myc-')
  if (next === text) continue
  changed++
  console.log(file)
  if (!process.argv.includes('--check')) writeFileSync(file, next)
}
console.log(`${changed} file(s)`)
