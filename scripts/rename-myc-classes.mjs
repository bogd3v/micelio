// One-off for #420 (epic #408, P5): renames every `bd-` name of the core to `myc-` (classes, ids, `data-bd-*` attributes,
// `useState` keys, keyframes, view-transition names). One to one, nothing else changes. Removed in #421 or #422.
// Run from the repo root on the tree of `main`: node scripts/rename-myc-classes.mjs [--check]
// Four files keep `bd-` on purpose and were edited by hand afterwards, so `--check` still lists them: the `$comment` of
// `app/theme/hooks.json`, the old-name messages of `modules/theme/css-rules.ts`, their test in `test/themeHooks.test.ts` and
// the migration section of `docs/themes/creating-a-theme.md`
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// Decision records and the performance history say what was true when written (ADR 0005, amendment of 2026-10-08)
const SKIP = /^(docs\/adr\/|docs\/performance\.md$|package-lock\.json$|scripts\/rename-myc-(layers|classes)\.mjs$)/
// The storage keys of P3 that the fallbacks still read until #422. `bd-privacy-notice` is also a class, so only its quoted
// or prose spellings are the key; `.bd-privacy-notice` and `class="bd-privacy-notice"` are renamed
const LEGACY_KEYS = /(?<![\w-])bd-(?:theme|read-articles)(?![\w-])|(?<=['`]|the )bd-privacy-notice(?![\w-])/g
// `useState('bd-theme')` and `useState('bd-read-articles')` are Nuxt state keys, not the storage keys, so they are renamed
const STATE_KEY = /(useState(?:<[^>]*>)?\(['`])bd-/g
const PREFIX = /\bbd-/g
const MARK = '\uE000' // a private-use character, absent from the sources

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(f => f && !SKIP.test(f))
let changed = 0
for (const file of files) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue // a tracked file that is not on disk (deleted, not staged)
  }
  if (text.includes('\0') || text.includes(MARK)) continue // binary
  const kept = []
  const next = text.replace(STATE_KEY, '$1myc-').replace(LEGACY_KEYS, key => (kept.push(key), MARK)).replace(PREFIX, 'myc-').replaceAll(MARK, () => kept.shift())
  if (next === text) continue
  changed++
  console.log(file)
  if (!process.argv.includes('--check')) writeFileSync(file, next)
}
console.log(`${changed} file(s)`)
