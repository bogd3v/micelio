import { AdmissionReportSchema } from '../../modules/theme/admission/report'
import type { CompatEntry } from './plan'

// Turns the admission reports of a core about to be released into what the release and the index do with them (#314, ADR 0008).

/** The outcome for one theme version. */
export interface CompatResult extends CompatEntry {
  outcome: 'pass' | 'fail' | 'unchecked'
  /** The first error, or why it was not checked; empty when it passed. */
  reason: string
  /** The workflow run that made the report; `null` when there is no report or its `run` is not a GitHub Actions run URL. */
  report: string | null
}

/** What the check decides. */
export interface CompatDecision {
  results: CompatResult[]
  /** Official versions that fail or could not be checked: they block the release. */
  blocking: CompatResult[]
  /** Published versions of the other tiers that fail: the index marks them incompatible from the version of the core being released. */
  incompatible: CompatResult[]
}

/** The reports of the themes that were admitted, by id; `undefined` when a theme's report is missing or does not match the schema. */
export type ReportsById = Map<string, unknown>

const RUN_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+(?:\/attempts\/\d+)?$/
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

/** Report text as one plain line: control and format characters (ANSI, bidi) and whitespace runs become one space, and backticks become `'` so the text cannot end a Markdown code span. */
function plain(text: string): string {
  return text.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/`/g, '\'').replace(/\s+/g, ' ').trim()
}

/** The run link of a report when it is a GitHub Actions run URL, else `null`: a report is untrusted, and its `z.url()` accepts whitespace, `|` and `)`. */
function runLink(run: string | null): string | null {
  return run !== null && RUN_URL.test(run) ? run : null
}

/** The version of a report when it is a semantic version, else a placeholder: it goes into a log line and a table. */
function versionText(version: string | null): string {
  return version === null ? 'no version' : SEMVER.test(version) ? version : 'an invalid version'
}

/**
 * Decides, from the plan and the admission reports, which versions block the release and which are marked incompatible.
 *
 * @remarks
 * A missing or unreadable report is a failure: an admission that did not run proves nothing. A failing `official` version
 * blocks, whatever its status; one of another tier is marked only when the index still says `published`, because the index
 * never changes an `incompatible` entry again.
 */
export function decide(checked: CompatEntry[], unchecked: Array<CompatEntry & { reason: string }>, reports: ReportsById): CompatDecision {
  const results: CompatResult[] = checked.map((entry) => {
    const parsed = AdmissionReportSchema.safeParse(reports.get(entry.id))
    if (!parsed.success) return { ...entry, outcome: 'fail', reason: 'the admission report is missing or not valid: the admission did not finish', report: null }
    const report = parsed.data
    const run = runLink(report.run)
    if (report.theme.version !== entry.version) return { ...entry, outcome: 'fail', reason: `the report is for ${versionText(report.theme.version)}, not ${entry.version}`, report: run }
    if (report.ok) return { ...entry, outcome: 'pass', reason: '', report: run }
    const first = report.errors[0]
    return { ...entry, outcome: 'fail', reason: first ? plain(`${first.check}: ${first.message}`) : 'the admission failed', report: run }
  })
  results.push(...unchecked.map((entry): CompatResult => ({ ...entry, outcome: 'unchecked', reason: entry.reason, report: null })))
  results.sort((a, b) => a.id.localeCompare(b.id))
  const failing = results.filter(result => result.outcome !== 'pass')
  return {
    results,
    blocking: failing.filter(result => result.tier === 'official'),
    incompatible: failing.filter(result => result.outcome === 'fail' && result.tier !== 'official' && result.status === 'published'),
  }
}

/** The line written to the index as the reason of an incompatible mark: one line of at most 500 characters. */
export function markReason(result: CompatResult, core: string): string {
  const text = plain(`fails admission on micelio ${core}: ${result.reason}`)
  return text.length > 500 ? `${text.slice(0, 499)}…` : text
}

/**
 * The table of the release notes and the run summary: theme, version, tier, result and the link to the report.
 *
 * @param marks - Whether the failures of the other tiers will be marked in the index from `core` (a release that publishes), or only reported.
 */
export function resultsTable(decision: CompatDecision, core: string, marks = true): string {
  // Report text is untrusted: it is shown as a code span, so it never renders as Markdown or HTML. GFM still reads a pipe inside a span as a cell break
  const cell = (text: string): string => `\`${plain(text).replace(/\\/g, '\\\\').replace(/\|/g, '\\|')}\``
  const rows = decision.results.map((result) => {
    const verdict = result.outcome === 'pass' ? 'pass' : result.outcome === 'unchecked' ? 'not checked' : 'fail'
    const consequence = decision.blocking.includes(result) ? ' (blocks the release)' : decision.incompatible.includes(result) ? (marks ? ' (incompatible from this core)' : ' (fails; not marked, the core is released)') : ''
    return `| ${result.id} | ${result.version} | ${result.tier} | ${verdict}${consequence}${result.reason ? `: ${cell(result.reason.slice(0, 200))}` : ''} | ${result.report ? `[report](${result.report})` : 'none'} |`
  })
  return ['### Published themes on micelio ' + core, '', '| Theme | Version | Tier | Result | Report |', '| --- | --- | --- | --- | --- |', ...(rows.length > 0 ? rows : ['| _none published_ | | | | |'])].join('\n')
}
