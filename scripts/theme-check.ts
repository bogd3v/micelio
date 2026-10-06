// `npm run theme:check [id] [--json]`: contract, hooks, contrast matrix and static budgets of the installed themes
// (ADR 0005, sections 7 and 9). Exit 1 when a theme has errors; warnings do not fail.
import { fileURLToPath } from 'node:url'
import { checkTheme, formatIssue } from '../modules/theme/check'
import { loadHooks } from '../modules/theme/hooks'
import { discoverThemes, themeRoots } from '../modules/theme/themes'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const json = args.includes('--json')
const id = args.find(arg => !arg.startsWith('--'))

try {
  const installed = discoverThemes(themeRoots(root))
  const themes = id ? installed.filter(theme => theme.id === id) : installed
  if (id && !themes.length) throw new Error(`Theme "${id}" is not installed (installed: ${installed.map(theme => theme.id).join(', ') || 'none'})`)
  const hooks = loadHooks(fileURLToPath(new URL('../app', import.meta.url)))
  const reports = themes.map(theme => checkTheme(theme, hooks))
  const failed = reports.some(report => report.errors.length)

  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: !failed, themes: reports }, null, 2)}\n`)
  } else {
    for (const report of reports) {
      process.stdout.write(`${report.theme}: ${report.errors.length ? `${report.errors.length} error(s)` : 'ok'}${report.warnings.length ? `, ${report.warnings.length} warning(s)` : ''}\n`)
      for (const issue of report.errors) process.stdout.write(`  error: ${formatIssue(report.theme, issue)}\n`)
      for (const issue of report.warnings) process.stdout.write(`  warning: ${formatIssue(report.theme, issue)}\n`)
    }
  }
  process.exit(failed ? 1 : 0)
} catch (error) {
  if (json) process.stdout.write(`${JSON.stringify({ ok: false, error: (error as Error).message }, null, 2)}\n`)
  else process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
