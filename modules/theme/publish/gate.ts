import { THEME_ID } from '../constants'
import type { AdmissionReport } from '../admission/types'

// The rules that belong to publishing and not to admission (#312): admission also runs for the core's own themes on every push, so a
// missing record of the manual accessibility check is only a warning there (standard, section 9).

/**
 * The reasons the admission report of `id` does not allow publishing, one line each; empty when it does.
 *
 * @remarks
 * A report blocks when it has errors, when it is for another theme, when it has no version, contract or package, and when the manual
 * accessibility record is missing, is for another version (`current: false`) or has a line that failed because of the theme. A failed line with `cause: "core"` (an issue of `bogd3v/micelio`, checked by the record's schema) stays in the report and does not block. `partial` (lines not verified) does
 * not block. An invalid record is already an error of the report.
 *
 * @param report - The `admission-report.json` of the run, already validated against its schema.
 * @param id - The theme the caller asked to publish.
 * @param accessibilityFile - Where the record belongs, for the message, such as `accessibility/bogota.json`.
 */
export function publishBlockers(report: AdmissionReport, id: string, accessibilityFile: string): string[] {
  const blockers: string[] = []
  if (!THEME_ID.test(id) || report.theme.id !== id) blockers.push(`the admission report is for "${report.theme.id}", not for "${id}"`)
  if (!report.ok) blockers.push(`admission found ${report.errors.length} error${report.errors.length === 1 ? '' : 's'}: ${report.errors[0]?.message.split('\n')[0] ?? 'see the report'}`)
  if (report.theme.version === null) blockers.push('theme.json has no "version"')
  if (report.theme.contract === null) blockers.push('theme.json declares no contract')
  if (report.package === null) blockers.push('the theme was not packed')
  const record = report.accessibility
  if (!record) blockers.push(`there is no valid manual accessibility record (${accessibilityFile}): run docs/themes/accessibility-checklist.md on this version and commit the record`)
  else if (!record.current) blockers.push(`the accessibility record (${accessibilityFile}) is for version ${record.record.version ?? 'none'}, not for ${report.theme.version ?? 'this version'}: run the checklist again`)
  else {
    const failed = Object.entries(record.record.lines).filter(([, line]) => line.result === 'fail' && line.cause !== 'core').map(([name]) => name)
    if (failed.length > 0) blockers.push(`the accessibility record (${accessibilityFile}) has a failed line (${failed.join(', ')}): fix what failed and run the checklist again`)
  }
  return blockers
}
