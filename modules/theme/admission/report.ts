import { z } from 'zod'

// The admission report of a theme version (ADR 0008, decision 5; #311): what was checked, against which core, and every error and warning.
// `npm run theme:schema` writes themes/admission-report.schema.json from this schema; docs/themes/publishing-a-theme.md explains it.

/** Version of the report format: raise it when a field changes meaning or is removed; adding an optional field keeps it. */
export const ADMISSION_REPORT_VERSION = 1

const Check = z.enum(['static', 'performance', 'quality', 'admission']).describe('Which check found the issue: `static` is `theme:check`, `performance` the budgets per site mode, `quality` visual regression and axe, `admission` the run itself (an install into the shared build that failed, a report trimmed to its cap).')

const Issue = z.strictObject({
  check: Check,
  kind: z.string().min(1).max(64).describe('What kind of problem: `contract`, `contrast`, `budget`, `third-party`, `axe`, `visual`, `motion`, `layout`, `missing` (a check that produced no result) and the like.'),
  message: z.string().min(1).max(4000),
  mode: z.string().max(64).optional().describe('The site mode of a performance issue, or the Playwright project (theme mode and viewport, such as `day-desktop`) of a quality issue.'),
}).describe('One problem, with the message the check printed, unchanged. An error blocks publishing; a warning is published with the version.')

const Status = z.enum(['passed', 'failed', 'skipped', 'missing']).describe('`missing`: the job that should have produced the result did not (it crashed, was cancelled or was skipped by a failure before it).')

const Build = z.strictObject({
  purpose: z.enum(['performance', 'quality']).describe('`quality` builds carry the specimen page (`MICELIO_SPECIMEN=1`).'),
  kind: z.enum(['shared', 'own']).describe('`shared`: one core build made without the theme and shared by every theme under admission; the theme was installed into its store. `own`: a build made with the theme, which a theme with code needs.'),
  coreBuild: z.string().min(1).max(200).describe('The Nuxt build id, which is the core build of the theme store\'s compile key (ADR 0009, section 1).'),
  baseTheme: z.string().max(64).optional().describe('The theme the shared build was made with; absent for `own`.'),
  reason: z.string().max(400).optional().describe('Why the theme could not use the shared build; absent for `shared`.'),
})

const PerformanceRun = z.strictObject({
  mode: z.string().min(1).max(64),
  displayFont: z.string().max(64).optional().describe('The curated display font set by the site for this run, when it is not the theme\'s own (ADR 0005, section 9).'),
  status: Status,
  pages: z.array(z.strictObject({ page: z.string().max(64), path: z.string().max(400), metrics: z.record(z.string(), z.unknown()) })).max(50).describe('Measurements per page, as `npm run perf -- --out` writes them; limits are in `scripts/perf/budgets.json` of the core ref.'),
  islands: z.record(z.string(), z.unknown()).optional(),
})

const QualitySpec = z.strictObject({
  file: z.string().min(1).max(200).describe('The spec file under `e2e/theme/`, such as `a11y.spec.ts` or `motion/reduced.spec.ts`.'),
  passed: z.int().min(0),
  failed: z.int().min(0),
  skipped: z.int().min(0),
})

const Quality = z.strictObject({
  status: Status,
  visual: z.boolean().describe('Whether visual regression ran; the baselines are read from the theme\'s source repository.'),
  specs: z.array(QualitySpec).max(100),
})

/** The admission report: `admission-report.json`, one per theme and run. */
export const AdmissionReportSchema = z.strictObject({
  schemaVersion: z.literal(ADMISSION_REPORT_VERSION),
  ok: z.boolean().describe('True when there is no error: the version may be published.'),
  generatedAt: z.iso.datetime(),
  theme: z.strictObject({
    id: z.string().min(1).max(64),
    version: z.string().max(128).nullable(),
    contract: z.string().max(16).nullable().describe('The contract `theme.json` declares, as `major.minor`.'),
    code: z.boolean().describe('Whether the theme ships `slots/` or `templates/`.'),
  }),
  core: z.strictObject({
    repository: z.string().min(1).max(200),
    ref: z.string().min(1).max(256),
    sha: z.string().regex(/^[0-9a-f]{40}$/),
    version: z.string().max(128).describe('The `version` of the core\'s `package.json`.'),
    contract: z.string().max(16).describe('The theme contract the core implements, as `major.minor`.'),
  }),
  run: z.url().max(400).nullable().describe('The workflow run that made the report, when it ran on GitHub Actions.'),
  builds: z.array(Build).max(20),
  package: z.strictObject({
    file: z.string().max(200),
    digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    bytes: z.int().min(0),
  }).nullable().describe('The package `theme:pack` made, or null when the theme cannot be packed (the reason is an error).'),
  checks: z.strictObject({
    static: z.strictObject({ status: Status }),
    performance: z.array(PerformanceRun).max(20),
    quality: Quality,
  }),
  errors: z.array(Issue).max(1000),
  warnings: z.array(Issue).max(1000),
}).describe('The admission report of one theme version: `admission-report.json`, written by `npm run theme:admit -- report`.')

/** An admission report as `theme:admit report` writes it. */
export type AdmissionReport = z.infer<typeof AdmissionReportSchema>

/** One error or warning of a report. */
export type AdmissionIssue = z.infer<typeof Issue>

/** A performance run of a report. */
export type AdmissionPerformanceRun = z.infer<typeof PerformanceRun>

/** The quality result of a report. */
export type AdmissionQuality = z.infer<typeof Quality>

/** The JSON Schema of the report, written to `themes/admission-report.schema.json`. */
export function admissionReportJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(AdmissionReportSchema, { target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>
  return {
    ...schema,
    $id: 'https://github.com/bogd3v/micelio/blob/main/themes/admission-report.schema.json',
    title: `Micelio theme admission report (version ${ADMISSION_REPORT_VERSION})`,
  }
}
