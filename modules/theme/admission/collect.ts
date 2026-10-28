import { ACCESSIBILITY_LINES, ADMISSION_REPORT_VERSION, AccessibilityRecordSchema, AdmissionReportSchema } from './report'
import type { AdmissionAccessibility, AdmissionIssue, AdmissionPerformanceRun, AdmissionQuality } from './report'
import type { AdmissionReport } from './types'

// Turns what each admission job wrote (`theme:admit static`, `perf --out`, Playwright's JSON report, the build records) into one report.
// Every input is `unknown`: a job that crashed leaves a file missing or cut, and the report says so instead of throwing.

/** The longest message a report keeps; Playwright's diffs can be much longer. */
const MESSAGE_MAX = 4000
/** Caps of the report schema on values a theme controls; past them the report is trimmed, never refused. */
const VERSION_MAX = 128
const PAGES_MAX = 50
const ISSUES_MAX = 1000
// eslint-disable-next-line no-control-regex -- Playwright colours its messages; the report keeps plain text
const ANSI = /\u001B\[[0-9;]*m/g

/** A performance run the plan expected, with what it wrote, if anything. */
export interface PerformanceInput {
  mode: string
  /** `heaviest` for the run with the heaviest curated display font. */
  font: 'default' | 'heaviest'
  /** The parsed `perf --out` file, or undefined when the job wrote none. */
  result?: unknown
}

/** What `assembleReport` needs: the files of one theme's admission, already parsed. */
export interface ReportInput {
  themeId: string
  /** The output of `theme:admit static` (with the accessibility record it read), or undefined when it is missing. */
  staticResult?: unknown
  performance: PerformanceInput[]
  /** Playwright's JSON report of `e2e/theme/`, or undefined when quality did not run or wrote nothing. */
  quality?: unknown
  /** Whether the plan asked for quality at all. */
  qualityExpected: boolean
  visual: boolean
  /** The build records (`theme:admit install` or `build-info`), as written. */
  builds: unknown[]
  core: AdmissionReport['core']
  run: string | null
  now: Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clip(message: string): string {
  const plain = message.replace(ANSI, '').trim()
  return plain.length > MESSAGE_MAX ? `${plain.slice(0, MESSAGE_MAX - 1)}…` : plain || '(no message)'
}

function issuesOf(list: unknown, check: AdmissionIssue['check']): AdmissionIssue[] {
  if (!Array.isArray(list)) return []
  return list.filter(isRecord).map(issue => ({ check, kind: typeof issue.kind === 'string' ? issue.kind.slice(0, 64) : 'other', message: clip(String(issue.message ?? '')) }))
}

/** The kind of a performance problem: third-party requests are their own kind (ADR 0005, section 9), FOUC and islands are `budget` like the rest. */
function performanceKind(metric: unknown): string {
  return metric === 'thirdPartyRequests' ? 'third-party' : 'budget'
}

function performanceRun(input: PerformanceInput, errors: AdmissionIssue[], warnings: AdmissionIssue[]): AdmissionPerformanceRun {
  const displayFont = input.font === 'heaviest' ? 'heaviest' : undefined
  const run = { mode: input.mode, ...(displayFont && { displayFont }) }
  const result = input.result
  if (!isRecord(result) || !Array.isArray(result.pages)) {
    errors.push({ check: 'performance', kind: 'missing', mode: input.mode, message: `The performance run of ${input.mode} mode${displayFont ? ' with the heaviest display font' : ''} produced no report: see its job log` })
    return { ...run, status: 'missing', pages: [] }
  }
  if (typeof result.displayFont === 'string') run.displayFont = result.displayFont
  let failed = false
  for (const problem of Array.isArray(result.problems) ? result.problems.filter(isRecord) : []) {
    const issue: AdmissionIssue = { check: 'performance', kind: performanceKind(problem.metric), mode: input.mode, message: clip(String(problem.message ?? '')) }
    if (problem.level === 'error') {
      errors.push(issue)
      failed = true
    } else warnings.push(issue)
  }
  const pages = result.pages.filter(isRecord).map(page => ({ page: String(page.page ?? ''), path: String(page.path ?? ''), metrics: isRecord(page.metrics) ? page.metrics : {} }))
  return { ...run, status: failed ? 'failed' : 'passed', pages, ...(isRecord(result.islands) && { islands: result.islands }) }
}

function qualityKind(file: string): string {
  if (file === 'a11y.spec.ts') return 'axe'
  if (file === 'visual.spec.ts') return 'visual'
  if (file.startsWith('motion/')) return 'motion'
  return file.replace(/\.spec\.ts$/, '')
}

interface PlaywrightTest { projectName?: unknown, status?: unknown, results?: unknown }

/** Walks Playwright's JSON report: counts per spec file, and one error per failed test with the message the run printed. */
function qualityResult(input: ReportInput, errors: AdmissionIssue[]): AdmissionQuality {
  if (!input.qualityExpected) return { status: 'skipped', visual: false, specs: [] }
  const report = input.quality
  if (!isRecord(report) || !Array.isArray(report.suites)) {
    errors.push({ check: 'quality', kind: 'missing', message: 'Visual regression and axe produced no report: see the job log' })
    return { status: 'missing', visual: input.visual, specs: [] }
  }
  const counts = new Map<string, { passed: number, failed: number, skipped: number }>()
  function walk(suite: Record<string, unknown>, file: string): void {
    for (const spec of Array.isArray(suite.specs) ? suite.specs.filter(isRecord) : []) {
      const specFile = typeof spec.file === 'string' ? spec.file : file
      const count = counts.get(specFile) ?? { passed: 0, failed: 0, skipped: 0 }
      counts.set(specFile, count)
      for (const test of (Array.isArray(spec.tests) ? spec.tests : []) as PlaywrightTest[]) {
        if (test.status === 'skipped') count.skipped++
        else if (test.status === 'expected') count.passed++
        else {
          count.failed++
          const results = Array.isArray(test.results) ? test.results.filter(isRecord) : []
          const last = results.at(-1)
          const error = isRecord(last?.error) ? String(last.error.message ?? '') : 'failed'
          errors.push({ check: 'quality', kind: qualityKind(specFile), mode: typeof test.projectName === 'string' ? test.projectName : undefined, message: clip(`${String(test.projectName ?? '')} › ${specFile} › ${String(spec.title ?? '')}: ${error}`) })
        }
      }
    }
    for (const child of Array.isArray(suite.suites) ? suite.suites.filter(isRecord) : []) walk(child, typeof child.file === 'string' ? child.file : file)
  }
  for (const suite of report.suites.filter(isRecord)) walk(suite, typeof suite.file === 'string' ? suite.file : String(suite.title ?? ''))
  // Errors outside any test: the web server did not start, a config error
  for (const error of Array.isArray(report.errors) ? report.errors.filter(isRecord) : []) errors.push({ check: 'quality', kind: 'run', message: clip(String(error.message ?? '')) })
  const specs = [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([file, count]) => ({ file, ...count }))
  const failed = specs.some(spec => spec.failed > 0) || (Array.isArray(report.errors) && report.errors.length > 0)
  // A run where nothing passed proves nothing (a misapplied filter, a theme with no modes): never a pass
  if (!failed && !specs.some(spec => spec.passed > 0)) {
    errors.push({ check: 'quality', kind: 'missing', message: 'Visual regression and axe ran no test: see the job log' })
    return { status: 'missing', visual: input.visual, specs }
  }
  return { status: failed ? 'failed' : 'passed', visual: input.visual, specs }
}

/**
 * The manual accessibility record that `theme:admit static` read, checked against its schema and the theme version.
 *
 * @remarks
 * No record, a record of another version and a failed line are warnings here, because admission also runs for themes that have no record; `publishBlockers` (`modules/theme/publish/gate.ts`) is what blocks publishing.
 * A record that does not match the schema is an error, so a typo never reads as a check that was made.
 */
function accessibilityResult(input: ReportInput, version: string | null, errors: AdmissionIssue[], warnings: AdmissionIssue[]): AdmissionAccessibility | undefined {
  const result = input.staticResult
  if (!isRecord(result)) return undefined // The static result is missing, which is already an error
  // No file named: the static step was run without `--accessibility` (by hand), so nothing was looked for
  if (typeof result.accessibilityFile !== 'string') return undefined
  const file = result.accessibilityFile
  if (typeof result.accessibilityError === 'string') {
    errors.push({ check: 'accessibility', kind: 'record', message: clip(`${file}: ${result.accessibilityError}`) })
    return undefined
  }
  // A file that could not be read has no `accessibility`, and returned above; a file holding `null` fails the schema below
  if (result.accessibility === undefined) {
    warnings.push({ check: 'accessibility', kind: 'missing', message: `${file} does not exist: the manual check of docs/themes/accessibility-checklist.md is not recorded` })
    return undefined
  }
  const parsed = AccessibilityRecordSchema.safeParse(result.accessibility)
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 20)) errors.push({ check: 'accessibility', kind: 'record', message: clip(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`) })
    return undefined
  }
  const record = parsed.data
  const current = record.version === version
  if (!current) warnings.push({ check: 'accessibility', kind: 'stale', message: `${file} records version ${record.version ?? '(none)'}, not ${version ?? '(none)'}: run the checklist again if the version changes CSS, markup or slots` })
  const results = ACCESSIBILITY_LINES.map(line => [line, record.lines[line]] as const)
  for (const [line, entry] of results) {
    if (entry.result === 'fail') warnings.push({ check: 'accessibility', kind: 'manual', message: clip(`${line} failed (${entry.issue})${entry.note ? `: ${entry.note}` : ''}`) })
  }
  const status = results.some(([, entry]) => entry.result === 'fail') ? 'failed' : results.some(([, entry]) => entry.result === 'not-verified') ? 'partial' : 'passed'
  return { status, current, record }
}

/** The theme part and the package, from `theme:admit static`. */
function staticResult(input: ReportInput, errors: AdmissionIssue[], warnings: AdmissionIssue[]): Pick<AdmissionReport, 'theme' | 'package'> & { status: AdmissionReport['checks']['static']['status'] } {
  const result = input.staticResult
  const unknownTheme = { id: input.themeId, version: null, contract: null, code: false }
  if (!isRecord(result)) {
    errors.push({ check: 'static', kind: 'missing', message: '`theme:check` and `theme:pack` produced no result: see the plan job log' })
    return { theme: unknownTheme, package: null, status: 'missing' }
  }
  const before = errors.length
  errors.push(...issuesOf(result.errors, 'static'))
  warnings.push(...issuesOf(result.warnings, 'static'))
  const pack = isRecord(result.package) && typeof result.package.digest === 'string' ? { file: String(result.package.file), digest: result.package.digest, bytes: Number(result.package.bytes) } : null
  if (!pack && typeof result.packError === 'string') errors.push({ check: 'static', kind: 'package', message: clip(result.packError) })
  const theme = isRecord(result.theme) ? { id: input.themeId, version: typeof result.theme.version === 'string' ? result.theme.version : null, contract: typeof result.theme.contract === 'string' ? result.theme.contract : null, code: result.theme.code === true } : unknownTheme
  return { theme, package: pack, status: errors.length > before ? 'failed' : 'passed' }
}

/**
 * The admission report of one theme, validated against its schema.
 *
 * @remarks
 * A check the plan expected and that wrote nothing is an error of kind `missing`, so a crashed job can never read as a pass.
 *
 * @throws `ZodError` when the assembled report does not match the schema: a bug in this function, not in the theme.
 */
export function assembleReport(input: ReportInput): AdmissionReport {
  const errors: AdmissionIssue[] = []
  const warnings: AdmissionIssue[] = []
  const { status: staticStatus, ...identity } = staticResult(input, errors, warnings)
  const performance = input.performance.map(run => performanceRun(run, errors, warnings))
  const quality = qualityResult(input, errors)
  const accessibility = accessibilityResult(input, identity.theme.version, errors, warnings)
  const builds = input.builds.filter(isRecord).map(({ error, ...build }) => {
    if (typeof error === 'string') errors.push({ check: 'admission', kind: 'install', message: clip(error) })
    return build
  })
  if (identity.theme.version !== null && identity.theme.version.length > VERSION_MAX) {
    errors.push({ check: 'static', kind: 'contract', message: `"version" is longer than ${VERSION_MAX} characters` })
    identity.theme.version = null
  }
  for (const run of performance) run.pages = run.pages.slice(0, PAGES_MAX)
  return AdmissionReportSchema.parse({
    schemaVersion: ADMISSION_REPORT_VERSION,
    ok: errors.length === 0,
    generatedAt: input.now.toISOString(),
    ...identity,
    core: input.core,
    run: input.run,
    builds,
    checks: { static: { status: staticStatus }, performance, quality },
    ...(accessibility && { accessibility }),
    errors: capped(errors),
    warnings: capped(warnings),
  })
}

/** At most `ISSUES_MAX` issues, the last one saying how many were left out. */
function capped(issues: AdmissionIssue[]): AdmissionIssue[] {
  if (issues.length <= ISSUES_MAX) return issues
  return [...issues.slice(0, ISSUES_MAX - 1), { check: 'admission', kind: 'truncated', message: `${issues.length - ISSUES_MAX + 1} more issues are in the job logs` }]
}

/** A Markdown summary of a report: the result, then every error and warning as printed. */
export function reportSummary(report: AdmissionReport): string {
  const lines = [
    `## Theme admission: ${report.theme.id}${report.theme.version ? ` ${report.theme.version}` : ''} ${report.ok ? 'passed' : 'failed'}`,
    '',
    `Core ${report.core.repository}@${report.core.ref} (${report.core.sha.slice(0, 12)}, ${report.core.version}, contract ${report.core.contract})${report.builds.map(build => `; ${build.purpose} build ${build.kind} \`${build.coreBuild}\``).join('')}`,
    '',
    ...(report.accessibility ? [`Manual accessibility check ${report.accessibility.status}${report.accessibility.current ? '' : ' (another version)'}, ${report.accessibility.record.date} by ${report.accessibility.record.by}`, ''] : []),
    ...report.errors.map(issue => `- **error** (${issue.check}, ${issue.kind}) ${issue.message.split('\n')[0]}`),
    ...report.warnings.map(issue => `- warning (${issue.check}, ${issue.kind}) ${issue.message.split('\n')[0]}`),
  ]
  return `${lines.join('\n')}\n`
}
