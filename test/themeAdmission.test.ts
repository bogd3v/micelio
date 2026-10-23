import { describe, expect, it } from 'vitest'
import { join, resolve } from 'node:path'
import { assembleReport, reportSummary } from '../modules/theme/admission/collect'
import type { ReportInput } from '../modules/theme/admission/collect'
import { ownBuildReason } from '../modules/theme/admission/plan'
import { AdmissionReportSchema, admissionReportJsonSchema } from '../modules/theme/admission/report'
import { discoverThemes } from '../modules/theme/themes'

const ROOT = resolve(__dirname, '..')
const CORE = { repository: 'bogd3v/micelio', ref: 'v0.5.0', sha: 'a'.repeat(40), version: '0.5.0', contract: '2.0' }
const STATIC_OK = { theme: { id: 'calm', version: '1.0.0', contract: '2.0', code: false }, errors: [], warnings: [], package: { file: 'calm-1.0.0.tgz', digest: `sha256:${'b'.repeat(64)}`, bytes: 1424 } }
const PERF_OK = { theme: 'calm', mode: 'dynamic', pages: [{ page: 'home', path: '/', metrics: { cssKb: 19 } }], problems: [] }
const BUILD = { purpose: 'performance', kind: 'shared', coreBuild: '57885e9e', baseTheme: 'minimal' }

/** A Playwright JSON report with one spec file and the given tests. */
function playwright(file: string, tests: { title: string, status: string, project?: string, message?: string }[]): unknown {
  return {
    suites: [{
      title: file,
      file,
      specs: tests.map(test => ({ title: test.title, file, tests: [{ projectName: test.project ?? 'day-desktop', status: test.status, results: [{ status: test.status === 'expected' ? 'passed' : 'failed', ...(test.message && { error: { message: test.message } }) }] }] })),
      suites: [],
    }],
    errors: [],
  }
}

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    themeId: 'calm',
    staticResult: STATIC_OK,
    performance: [{ mode: 'dynamic', font: 'default', result: PERF_OK }],
    quality: playwright('a11y.spec.ts', [{ title: 'home has no axe violations', status: 'expected' }]),
    qualityExpected: true,
    visual: false,
    builds: [BUILD],
    core: CORE,
    run: 'https://github.com/example/calm/actions/runs/1',
    now: new Date('2026-10-23T12:00:00Z'),
    ...overrides,
  }
}

describe('assembleReport', () => {
  it('passes a theme whose every check passed, and names the build it was measured on', () => {
    const report = assembleReport(input())
    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.builds).toEqual([BUILD])
    expect(report.package?.digest).toBe(STATIC_OK.package.digest)
    expect(report.checks.quality).toEqual({ status: 'passed', visual: false, specs: [{ file: 'a11y.spec.ts', passed: 1, failed: 0, skipped: 0 }] })
    expect(AdmissionReportSchema.parse(report)).toEqual(report)
  })

  it('keeps the messages of theme:check and splits errors from warnings', () => {
    const contrast = 'theme "calm", mode "day": "ink-muted" on "surface" has 1.90:1, needs 4.5:1; nearest passing value #766759'
    const fonts = 'theme "calm": fonts total 120.0 KB, over the 100.0 KB target (allowed up to 150.8 KB)'
    const report = assembleReport(input({ staticResult: { ...STATIC_OK, package: undefined, errors: [{ kind: 'contrast', message: contrast }], warnings: [{ kind: 'budget', message: fonts }] } }))
    expect(report.ok).toBe(false)
    expect(report.package).toBeNull()
    expect(report.checks.static.status).toBe('failed')
    expect(report.errors).toEqual([{ check: 'static', kind: 'contrast', message: contrast }])
    expect(report.warnings).toEqual([{ check: 'static', kind: 'budget', message: fonts }])
  })

  it('reports a package that cannot be made as an error', () => {
    const report = assembleReport(input({ staticResult: { ...STATIC_OK, package: undefined, packError: 'theme:pack: "version" is required' } }))
    expect(report.errors).toEqual([{ check: 'static', kind: 'package', message: 'theme:pack: "version" is required' }])
  })

  it('makes budget errors block and budget targets warn, with the lines perf printed', () => {
    const error = 'ERROR [theme calm, dynamic mode] home: cssKb 24.9 exceeds the budget of 22.4'
    const warn = 'warn  [theme calm, dynamic mode] home: lcpMs 2738 exceeds the budget of 2500'
    const third = 'ERROR [theme calm, dynamic mode] home: thirdPartyRequests 1 exceeds the budget of 0'
    const perf = { ...PERF_OK, problems: [{ level: 'error', metric: 'cssKb', message: error }, { level: 'warn', metric: 'lcpMs', message: warn }, { level: 'error', metric: 'thirdPartyRequests', message: third }] }
    const report = assembleReport(input({ performance: [{ mode: 'dynamic', font: 'default', result: perf }] }))
    expect(report.errors).toEqual([
      { check: 'performance', kind: 'budget', mode: 'dynamic', message: error },
      { check: 'performance', kind: 'third-party', mode: 'dynamic', message: third },
    ])
    expect(report.warnings).toEqual([{ check: 'performance', kind: 'budget', mode: 'dynamic', message: warn }])
    expect(report.checks.performance[0]!.status).toBe('failed')
  })

  it('counts a run that wrote nothing, or a cut file, as an error, never as a pass', () => {
    const report = assembleReport(input({ staticResult: undefined, performance: [{ mode: 'dynamic', font: 'heaviest', result: undefined }, { mode: 'static', font: 'default', result: { pages: 'cut' } }], quality: undefined }))
    expect(report.ok).toBe(false)
    expect(report.errors.map(issue => `${issue.check}:${issue.kind}`)).toEqual(['static:missing', 'performance:missing', 'performance:missing', 'quality:missing'])
    expect(report.checks.performance.map(run => [run.mode, run.status, run.displayFont])).toEqual([['dynamic', 'missing', 'heaviest'], ['static', 'missing', undefined]])
  })

  it('turns each failed Playwright test into one error with its project, spec and plain message', () => {
    const quality = playwright('a11y.spec.ts', [
      { title: 'home has no axe violations', status: 'unexpected', message: '\u001B[2mexpect(\u001B[22mreceived\u001B[2m).toEqual\n+   "color-contrast: .myc-post-row-meta"' },
      { title: 'blog has no axe violations', status: 'expected' },
      { title: 'specimen has no axe violations', status: 'skipped' },
    ])
    const report = assembleReport(input({ quality }))
    expect(report.errors).toEqual([{ check: 'quality', kind: 'axe', mode: 'day-desktop', message: 'day-desktop › a11y.spec.ts › home has no axe violations: expect(received).toEqual\n+   "color-contrast: .myc-post-row-meta"' }])
    expect(report.checks.quality.specs).toEqual([{ file: 'a11y.spec.ts', passed: 1, failed: 1, skipped: 1 }])
  })

  it('reports an error outside any test, such as a server that did not start', () => {
    const report = assembleReport(input({ quality: { suites: [], errors: [{ message: 'Timed out waiting 240000ms from config.webServer.' }] } }))
    expect(report.checks.quality.status).toBe('failed')
    expect(report.errors).toEqual([{ check: 'quality', kind: 'run', message: 'Timed out waiting 240000ms from config.webServer.' }])
  })

  it('counts a quality run where no test passed as missing, not passed', () => {
    const report = assembleReport(input({ quality: playwright('a11y.spec.ts', [{ title: 'home has no axe violations', status: 'skipped' }]) }))
    expect(report.ok).toBe(false)
    expect(report.checks.quality.status).toBe('missing')
    expect(report.errors).toEqual([{ check: 'quality', kind: 'missing', message: 'Visual regression and axe ran no test: see the job log' }])
  })

  it('quotes a failed install into the shared build and keeps the build in the report', () => {
    const report = assembleReport(input({ builds: [{ ...BUILD, error: 'Installing "calm" into the shared build failed: NUXT_PUBLIC_THEME is "calm": its layout variants differ' }] }))
    expect(report.builds).toEqual([BUILD])
    expect(report.errors).toEqual([{ check: 'admission', kind: 'install', message: 'Installing "calm" into the shared build failed: NUXT_PUBLIC_THEME is "calm": its layout variants differ' }])
  })

  it('trims what a theme controls past the caps of the schema instead of refusing the report', () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({ kind: 'contract', message: `problem ${i}` }))
    const report = assembleReport(input({ staticResult: { ...STATIC_OK, theme: { ...STATIC_OK.theme, version: '1'.repeat(200) }, errors: many } }))
    expect(report.theme.version).toBeNull()
    expect(report.errors).toHaveLength(1000)
    expect(report.errors.at(-1)).toEqual({ check: 'admission', kind: 'truncated', message: '502 more issues are in the job logs' })
  })

  it('skips quality when the plan did not ask for it', () => {
    const report = assembleReport(input({ qualityExpected: false, quality: undefined }))
    expect(report.ok).toBe(true)
    expect(report.checks.quality.status).toBe('skipped')
  })
})

describe('reportSummary', () => {
  it('names the theme, the core and the build, then lists every problem', () => {
    const summary = reportSummary(assembleReport(input({ staticResult: { ...STATIC_OK, errors: [{ kind: 'contrast', message: 'low contrast' }] } })))
    expect(summary).toContain('## Theme admission: calm 1.0.0 failed')
    expect(summary).toContain('bogd3v/micelio@v0.5.0 (aaaaaaaaaaaa, 0.5.0, contract 2.0); performance build shared `57885e9e`')
    expect(summary).toContain('- **error** (static, contrast) low contrast')
  })
})

describe('ownBuildReason', () => {
  const [base] = discoverThemes([join(ROOT, 'test/fixtures/themes/minimal')])
  const theme = (dir: string) => discoverThemes([join(ROOT, dir)])[0]!

  it('admits a data-only theme with the default layout on the shared build', () => {
    expect(ownBuildReason(theme('test/fixtures/themes/data-only'), base!)).toBeUndefined()
  })

  it('gives a theme with slots a build of its own', () => {
    expect(ownBuildReason(theme('themes/starter'), base!)).toMatch(/^ships slots\/ or templates\//)
  })
})

describe('admissionReportJsonSchema', () => {
  it('is a draft 2020-12 schema with the id it is published under', () => {
    const schema = admissionReportJsonSchema()
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.$id).toBe('https://github.com/bogd3v/micelio/blob/main/themes/admission-report.schema.json')
    expect(Object.keys(schema.properties as object)).toContain('errors')
  })
})
