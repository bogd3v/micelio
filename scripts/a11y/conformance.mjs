// Writes the accessibility conformance report of the core with one theme (#845): a Markdown file with a result per WCAG 2.2 success
// criterion, from the axe run of `npm run test:theme` (Playwright's JSON report) and the theme's manual record
// (docs/themes/accessibility-checklist.md). The report never claims more than the record: see docs/operate/accessibility-report.md.
//
//   npm run a11y:report -- [--theme starter] [--axe <report.json>] [--record <record.json>] [--out <report.md>]
//
// The axe report is the one `THEME_REPORT_JSON=<file> npm run test:theme` writes (docs/theme-testing.md).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The lines of the checklist, in order; `test/a11yConformance.test.ts` keeps them equal to `ACCESSIBILITY_LINES` in `modules/theme/admission/report.ts`. */
export const LINES = [
  'keyboard.operable', 'keyboard.order', 'keyboard.focus-visible', 'keyboard.focus-not-hidden', 'keyboard.skip-link', 'keyboard.overlays',
  'screen-reader.landmarks', 'screen-reader.headings', 'screen-reader.names', 'screen-reader.announcements', 'screen-reader.language',
  'zoom.200', 'zoom.reflow-320', 'zoom.text-spacing',
  'motion.reduced', 'motion.forced-colors',
  'pointer.target-size', 'pointer.dragging',
]

/**
 * The success criteria the checklist reaches, with the lines that check each. A criterion takes the worst result of its lines.
 * The mapping is this report's own reading of the checklist, not a claim of the WCAG working group.
 */
export const CRITERIA = [
  { id: '1.3.1', name: 'Info and Relationships', level: 'A', lines: ['screen-reader.landmarks', 'screen-reader.headings'] },
  { id: '1.4.1', name: 'Use of Color', level: 'A', lines: ['motion.forced-colors'] },
  { id: '1.4.4', name: 'Resize Text', level: 'AA', lines: ['zoom.200'] },
  { id: '1.4.10', name: 'Reflow', level: 'AA', lines: ['zoom.reflow-320'] },
  { id: '1.4.11', name: 'Non-text Contrast', level: 'AA', lines: ['keyboard.focus-visible', 'motion.forced-colors'] },
  { id: '1.4.12', name: 'Text Spacing', level: 'AA', lines: ['zoom.text-spacing'] },
  { id: '2.1.1', name: 'Keyboard', level: 'A', lines: ['keyboard.operable'] },
  { id: '2.1.2', name: 'No Keyboard Trap', level: 'A', lines: ['keyboard.overlays'] },
  { id: '2.2.2', name: 'Pause, Stop, Hide', level: 'A', lines: ['motion.reduced'] },
  { id: '2.4.1', name: 'Bypass Blocks', level: 'A', lines: ['keyboard.skip-link', 'screen-reader.landmarks'] },
  { id: '2.4.3', name: 'Focus Order', level: 'A', lines: ['keyboard.order', 'keyboard.overlays'] },
  { id: '2.4.6', name: 'Headings and Labels', level: 'AA', lines: ['screen-reader.headings', 'screen-reader.names'] },
  { id: '2.4.7', name: 'Focus Visible', level: 'AA', lines: ['keyboard.focus-visible'] },
  { id: '2.4.11', name: 'Focus Not Obscured (Minimum)', level: 'AA', lines: ['keyboard.focus-not-hidden'] },
  { id: '2.5.7', name: 'Dragging Movements', level: 'AA', lines: ['pointer.dragging'] },
  { id: '2.5.8', name: 'Target Size (Minimum)', level: 'AA', lines: ['pointer.target-size'] },
  { id: '3.1.1', name: 'Language of Page', level: 'A', lines: ['screen-reader.language'] },
  { id: '3.1.2', name: 'Language of Parts', level: 'AA', lines: ['screen-reader.language'] },
  { id: '4.1.2', name: 'Name, Role, Value', level: 'A', lines: ['screen-reader.names'] },
  { id: '4.1.3', name: 'Status Messages', level: 'AA', lines: ['screen-reader.announcements'] },
]

/** The note on the Colombian standard: a mapping to the WCAG criteria above, never a second claim. */
export const NTC_5854_NOTE = 'NTC 5854 (the Colombian accessibility standard for web pages) takes its requirements from the WCAG success criteria listed above, so the results here map to it. This report makes no separate claim of conformance to NTC 5854.'

const RESULTS = ['pass', 'fail', 'not-verified']
const AXE_SPECS = /(^|\/)(core-)?a11y\.spec\.ts$/
const AXE_TITLE = /axe violations/

/**
 * Checks a manual record and returns its lines. A missing record (`undefined`) gives every line `not-verified`.
 * @param {unknown} record parsed `accessibility/<theme>.json`, or `undefined`
 * @returns {{ lines: Record<string, { result: string, issue?: string, cause?: string, note?: string }>, meta: { version: string | null, core?: string, date?: string, by?: string, method?: string } | null }}
 * @throws {Error} when the record is not an object with a valid entry for every line of the checklist
 */
export function readRecord(record) {
  if (record === undefined) {
    return { meta: null, lines: Object.fromEntries(LINES.map(line => [line, { result: 'not-verified', note: 'The core has no record for this theme.' }])) }
  }
  if (typeof record !== 'object' || record === null || typeof record.lines !== 'object' || record.lines === null) throw new Error('the record has no "lines" object')
  const lines = {}
  for (const line of LINES) {
    const entry = record.lines[line]
    if (!entry || !RESULTS.includes(entry.result)) throw new Error(`the record has no valid result for "${line}"`)
    if (entry.result === 'fail' && !entry.issue) throw new Error(`the failing line "${line}" has no issue`)
    if (entry.result === 'not-verified' && !entry.note) throw new Error(`the line "${line}" is not verified and gives no reason`)
    lines[line] = entry
  }
  for (const line of Object.keys(record.lines)) if (!LINES.includes(line)) throw new Error(`the record has an unknown line "${line}"`)
  const { version = null, core, date, by, method } = record
  return { lines, meta: { version, core, date, by, method } }
}

/**
 * The axe tests of a Playwright JSON report (`a11y.spec.ts` and `core-a11y.spec.ts`, the tests whose title says "axe violations").
 * @param {unknown} report parsed Playwright JSON report, or `undefined` when there is none
 * @returns {{ total: number, passed: number, failed: { title: string, project: string }[] } | null} `null` when no axe test ran
 */
export function readAxe(report) {
  if (!report || typeof report !== 'object') return null
  let total = 0
  let passed = 0
  const failed = []
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      if (!AXE_SPECS.test(spec.file ?? suite.file ?? '') || !AXE_TITLE.test(spec.title)) continue
      for (const test of spec.tests ?? []) {
        if (test.status === 'skipped') continue
        total++
        if (test.status === 'expected') passed++
        else failed.push({ title: spec.title, project: test.projectName ?? '' })
      }
    }
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of report.suites ?? []) walk(suite)
  return total === 0 ? null : { total, passed, failed }
}

/** @param {string[]} results @returns {string} the worst of `fail`, `not-verified`, `pass` */
function worst(results) {
  return results.includes('fail') ? 'fail' : results.includes('not-verified') ? 'not-verified' : 'pass'
}

/**
 * The result of every criterion, the counts of the record's lines and the verdict.
 * @param {ReturnType<typeof readRecord>['lines']} lines
 * @param {ReturnType<typeof readAxe>} axe
 * @returns {{ criteria: (typeof CRITERIA[number] & { result: string })[], counts: Record<string, number>, conforms: boolean }}
 */
export function evaluate(lines, axe) {
  const counts = { 'pass': 0, 'fail': 0, 'not-verified': 0 }
  for (const line of LINES) counts[lines[line].result]++
  const criteria = CRITERIA.map(criterion => ({ ...criterion, result: worst(criterion.lines.map(line => lines[line].result)) }))
  const axeClean = axe !== null && axe.failed.length === 0
  return { criteria, counts, conforms: counts.fail === 0 && counts['not-verified'] === 0 && axeClean }
}

const LABEL = { 'pass': 'Supports', 'fail': 'Does not support', 'not-verified': 'Not verified' }

/** @param {string} text @returns {string} the text safe inside a table cell */
function cell(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')
}

/**
 * The Markdown report.
 * @param {{ theme: string, core: string, themeVersion: string | null, record: unknown, axe: unknown }} input `record` and `axe` are parsed JSON, or `undefined` when the file is missing
 * @returns {string}
 */
export function buildReport({ theme, core, themeVersion, record, axe: axeReport }) {
  const { lines, meta } = readRecord(record)
  const axe = readAxe(axeReport)
  const { criteria, counts, conforms } = evaluate(lines, axe)
  const out = []
  out.push(`# Accessibility conformance report: Micelio ${core} with the \`${theme}\` theme`, '')
  out.push('Target: WCAG 2.2, level AA (section 9 of the engineering standard). Sources: the axe run of `npm run test:theme` and the manual record of the theme (`docs/themes/accessibility-checklist.md`).', '')
  out.push('## Summary', '')
  if (conforms) {
    out.push(`**Conforms to WCAG 2.2 level AA on the pages and for the criteria this report covers.** All ${LINES.length} lines of the record pass and axe found no violation in ${axe.total} runs. Criteria outside the table below are not assessed.`)
  } else {
    const reasons = []
    if (counts.fail) reasons.push(`${counts.fail} line${counts.fail === 1 ? '' : 's'} of the record fail${counts.fail === 1 ? 's' : ''}`)
    if (counts['not-verified']) reasons.push(`${counts['not-verified']} ${counts['not-verified'] === 1 ? 'line is' : 'lines are'} not verified`)
    if (axe === null) reasons.push('there is no axe result')
    else if (axe.failed.length) reasons.push(`axe failed in ${axe.failed.length} of ${axe.total} runs`)
    out.push(`**Does not claim conformance:** ${reasons.join('; ')}.`)
  }
  out.push('', `- Record lines: ${counts.pass} pass, ${counts.fail} fail, ${counts['not-verified']} not verified (of ${LINES.length}).`)
  out.push(`- Criteria: ${criteria.filter(c => c.result === 'pass').length} supported, ${criteria.filter(c => c.result === 'fail').length} not supported, ${criteria.filter(c => c.result === 'not-verified').length} not verified (of ${criteria.length}).`)
  out.push(axe ? `- Axe: ${axe.passed} of ${axe.total} runs without violations.` : '- Axe: no result.', '')
  out.push('## What was checked', '')
  out.push(`- Theme: \`${theme}\`${themeVersion ? ` ${themeVersion}` : ''}, on core ${core}.`)
  if (meta) {
    out.push(`- Record: ${meta.date ?? 'undated'}${meta.core ? `, core \`${meta.core}\`` : ''}${meta.version ? `, theme version ${meta.version}` : ''}${meta.by ? `, by ${meta.by}` : ''}.`)
    if (meta.method) out.push(`- Method: ${meta.method}.`)
  } else {
    out.push('- Record: none.')
  }
  out.push('', '## Axe (automated)', '')
  if (axe === null) {
    out.push('Not verified: the report of `npm run test:theme` has no axe result.')
  } else if (axe.failed.length === 0) {
    out.push(`No violations in ${axe.total} runs (tags \`wcag2a\`, \`wcag2aa\`, \`wcag21a\`, \`wcag21aa\`, \`wcag22aa\`; every page, mode and viewport of the theme tests). Axe finds only part of the problems.`)
  } else {
    out.push(`Violations in ${axe.failed.length} of ${axe.total} runs:`, '', ...axe.failed.map(f => `- ${f.title} (${f.project})`))
  }
  out.push('', '## Success criteria', '')
  out.push('| Criterion | Level | Result | Lines | Issue or reason |', '| --- | --- | --- | --- | --- |')
  for (const criterion of criteria) {
    const detail = criterion.lines.flatMap((line) => {
      const entry = lines[line]
      if (entry.result === 'fail') return [`${line}: ${entry.issue}${entry.cause === 'core' ? ' (core)' : ''}${entry.note ? `, ${entry.note}` : ''}`]
      if (entry.result === 'not-verified') return [`${line}: ${entry.note}`]
      return []
    })
    out.push(`| ${criterion.id} ${criterion.name} | ${criterion.level} | ${LABEL[criterion.result]} | ${criterion.lines.map(l => `\`${l}\``).join(', ')} | ${cell(detail.join('; ') || '-')} |`)
  }
  out.push('', '## NTC 5854', '', NTC_5854_NOTE, '')
  return out.join('\n')
}

/** @param {string} file @returns {unknown} the parsed JSON, or `undefined` when the file does not exist */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw new Error(`cannot read ${file}: ${error.message}`, { cause: error })
  }
}

/**
 * The command: reads the files, writes the report and prints its path.
 * @param {string[]} argv the arguments after the script
 * @returns {number} the exit code
 */
export function main(argv) {
  const options = { theme: 'starter', axe: '.micelio/a11y/quality.json', out: '.micelio/a11y/conformance.md' }
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '')
    if (!['theme', 'axe', 'record', 'out'].includes(key) || argv[i + 1] === undefined) {
      console.error('usage: a11y:report [--theme <id>] [--axe <report.json>] [--record <record.json>] [--out <report.md>]')
      return 2
    }
    options[key] = argv[i + 1]
  }
  options.record ??= `accessibility/${options.theme}.json`
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const manifest = readJson(`themes/${options.theme}/theme.json`)
    const text = buildReport({
      theme: options.theme,
      core: `v${pkg.version}`,
      themeVersion: manifest?.version ?? null,
      record: readJson(options.record),
      axe: readJson(options.axe),
    })
    mkdirSync(dirname(options.out), { recursive: true })
    writeFileSync(options.out, text)
    console.log(`wrote ${options.out}`)
    return 0
  } catch (error) {
    console.error(`a11y:report: ${error.message}`)
    return 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2))
