import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACCESSIBILITY_LINES, AccessibilityRecordSchema } from '../modules/theme/admission/report'
import { CRITERIA, LINES, NTC_5854_NOTE, buildReport, evaluate, readAxe, readRecord } from '../scripts/a11y/conformance.mjs'

type Line = { result: 'pass' } | { result: 'fail', issue: string, cause?: string, note?: string } | { result: 'not-verified', note: string }

function record(overrides: Record<string, Line> = {}): unknown {
  return {
    version: '0.1.0',
    core: 'v0.7.0',
    date: '2026-11-09',
    by: 'Ana',
    lines: Object.fromEntries(LINES.map(line => [line, overrides[line] ?? { result: 'pass' }])),
  }
}

function axeReport(statuses: string[]): unknown {
  return {
    suites: [{
      file: 'a11y.spec.ts',
      specs: statuses.map((status, index) => ({
        title: `page ${index} has no axe violations`,
        file: 'a11y.spec.ts',
        tests: [{ projectName: 'day-desktop', status }],
      })),
    }],
  }
}

const input = (rec: unknown, axe: unknown) => ({ theme: 'starter', core: 'v0.7.0', themeVersion: '0.1.0', record: rec, axe })

describe('the conformance report', () => {
  it('a failing line of the record is reported as does not support, with its issue', () => {
    const issue = 'https://github.com/bogd3v/micelio/issues/615'
    const text = buildReport(input(record({ 'keyboard.focus-not-hidden': { result: 'fail', issue, cause: 'core' } }), axeReport(['expected'])))
    const row = text.split('\n').find(line => line.startsWith('| 2.4.11'))
    expect(row).toContain('Does not support')
    expect(row).toContain(issue)
    expect(text).toContain('Does not claim conformance:** 1 line of the record fails')
  })

  it('the summary claims conformance only when every line passes', () => {
    const clean = buildReport(input(record(), axeReport(['expected', 'expected'])))
    expect(clean).toContain('**Conforms to WCAG 2.2 level AA')
    const unverified = buildReport(input(record({ 'zoom.text-spacing': { result: 'not-verified', note: 'no bookmarklet' } }), axeReport(['expected'])))
    expect(unverified).not.toContain('Conforms')
    expect(unverified).toContain('1 line is not verified')
    expect(unverified).toMatch(/\| 1\.4\.12 Text Spacing \| AA \| Not verified \|.*no bookmarklet/)
    const failed = buildReport(input(record({ 'pointer.dragging': { result: 'fail', issue: 'https://example.com/1' } }), axeReport(['expected'])))
    expect(failed).not.toContain('Conforms')
    // every line passing is not enough while axe failed or did not run
    expect(buildReport(input(record(), axeReport(['expected', 'unexpected'])))).not.toContain('Conforms')
    expect(buildReport(input(record(), undefined))).not.toContain('Conforms')
    expect(buildReport(input(record(), axeReport(['skipped'])))).not.toContain('Conforms')
  })

  it('a missing record claims nothing', () => {
    const text = buildReport(input(undefined, axeReport(['expected'])))
    expect(text).not.toContain('Conforms')
    expect(text).toContain('The core has no record for this theme.')
    expect(text).toContain(`${LINES.length} lines are not verified`)
  })

  it('a criterion takes the worst result of its lines', () => {
    const lines = readRecord(record({
      'keyboard.focus-visible': { result: 'not-verified', note: 'x' },
      'motion.forced-colors': { result: 'fail', issue: 'https://example.com/2' },
    })).lines
    const result = Object.fromEntries(evaluate(lines, null).criteria.map(criterion => [criterion.id, criterion.result]))
    expect(result['1.4.11']).toBe('fail')
    expect(result['2.4.7']).toBe('not-verified')
    expect(result['2.1.1']).toBe('pass')
  })

  it('NTC 5854 is a note that maps to the criteria, not a second claim', () => {
    const text = buildReport(input(record(), axeReport(['expected'])))
    expect(text).toContain(NTC_5854_NOTE)
    expect(NTC_5854_NOTE).toContain('no separate claim')
    expect(text.match(/## NTC 5854/g)).toHaveLength(1)
  })

  it('refuses a record that misses a line, fails one without an issue or leaves one unexplained', () => {
    const missing = record() as { lines: Record<string, unknown> }
    delete missing.lines['zoom.200']
    expect(() => readRecord(missing)).toThrow('zoom.200')
    expect(() => readRecord(record({ 'zoom.200': { result: 'fail' } as Line }))).toThrow('no issue')
    expect(() => readRecord(record({ 'zoom.200': { result: 'not-verified' } as Line }))).toThrow('gives no reason')
    expect(() => readRecord({ ...(record() as object), lines: { ...(record() as { lines: object }).lines, extra: { result: 'pass' } } })).toThrow('unknown line')
  })

  it('reads the axe tests of the Playwright report, nested suites included', () => {
    const report = {
      suites: [{
        file: 'x',
        suites: [{
          file: 'core-a11y.spec.ts',
          specs: [
            { title: 'the Spanish article has no axe violations, citations included', file: 'core-a11y.spec.ts', tests: [{ projectName: 'night-mobile', status: 'unexpected' }, { projectName: 'night-desktop', status: 'expected' }] },
            { title: 'the specimen has one h1', file: 'core-a11y.spec.ts', tests: [{ projectName: 'night-mobile', status: 'unexpected' }] },
          ],
        }],
      }, { file: 'visual.spec.ts', specs: [{ title: 'home has no axe violations', file: 'visual.spec.ts', tests: [{ status: 'unexpected' }] }] }],
    }
    expect(readAxe(report)).toEqual({ total: 2, passed: 1, failed: [{ title: 'the Spanish article has no axe violations, citations included', project: 'night-mobile' }] })
    expect(readAxe({ suites: [] })).toBeNull()
    expect(readAxe(undefined)).toBeNull()
  })

  it('keeps the checklist lines of the admission schema', () => {
    expect(LINES).toEqual([...ACCESSIBILITY_LINES])
    const mapped = new Set(CRITERIA.flatMap(criterion => criterion.lines))
    expect([...mapped].sort()).toEqual([...LINES].sort())
  })

  it('the record of starter is valid and the report built from it never claims more than its lines', () => {
    const file = JSON.parse(readFileSync('accessibility/starter.json', 'utf8'))
    expect(AccessibilityRecordSchema.safeParse(file).success).toBe(true)
    const results = Object.values(file.lines as Record<string, { result: string }>).map(line => line.result)
    const text = buildReport(input(file, axeReport(['expected'])))
    expect(text.includes('**Conforms')).toBe(results.every(result => result === 'pass'))
  })

  it('the release workflow writes the report in a read-only job and attaches it to the release', () => {
    const release = readFileSync('.github/workflows/release.yml', 'utf8')
    const report = release.slice(release.indexOf('  a11y-report:'), release.indexOf('  a11y-attach:'))
    expect(report).toContain('npm run a11y:report')
    expect(report).toMatch(/permissions:\n {6}contents: read\n/)
    expect(report).toContain('persist-credentials: false')
    expect(report).not.toContain('contents: write')
    const attach = release.slice(release.indexOf('  a11y-attach:'))
    // Without a status function, a failed community theme in `compat` would skip the job and publish the release without its report
    expect(attach).toMatch(/if: \$\{\{ !cancelled\(\) && /)
    expect(attach).toContain('gh release upload "$TAG" "accessibility-conformance-$TAG.md"')
    expect(attach).not.toMatch(/npm |checkout/)
  })
})
