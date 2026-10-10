import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { transform } from 'lightningcss'
import { contrastProblems } from './contrast'
import { contractProblems } from './contract'
import { themeProblems } from './validate'
import type { Hooks, InstalledTheme } from './types'

// `npm run theme:check`: what the build validates, plus contrast and static budgets (ADR 0005, sections 7 and 9).
// Contrast is not part of the build, so a theme in progress does not stop `nuxt dev`.

const MAX_CSS_GZIP_BYTES = 25 * 1024
const MAX_FONT_FAMILIES = 2
/** Warning above this total; error above FONT_TOTAL_MAX_BYTES, Bogotá's recorded exception (ADR 0005, section 9). KB are KiB like perf's fontKb. */
const FONT_TOTAL_WARN_BYTES = 100 * 1024
/**
 * Error above this font total: Bogotá's recorded exception (ADR 0005, section 9). KB are KiB like perf's `fontKb`.
 *
 * @internal Exported for tests.
 */
export const FONT_TOTAL_MAX_BYTES = 150.8 * 1024

type IssueKind = 'contract' | 'contrast' | 'budget'

interface ThemeIssue {
  kind: IssueKind
  message: string
  mode?: string
  role?: string
  surface?: string
  ratio?: number | null
  min?: number
  suggestion?: string | null
}

interface ThemeReport {
  theme: string
  errors: ThemeIssue[]
  warnings: ThemeIssue[]
}

/** theme.css, sections.css and the slots' stylesheets, minified when they parse, as one string. */
function themeCss(dir: string): string {
  const files = [join(dir, 'theme.css'), join(dir, 'sections.css')]
  const slots = join(dir, 'slots')
  if (existsSync(slots)) files.push(...readdirSync(slots).filter(file => file.endsWith('.css')).sort().map(file => join(slots, file)))
  return files.filter(existsSync).map((file) => {
    const text = readFileSync(file, 'utf8')
    try {
      return transform({ filename: file, code: Buffer.from(text), minify: true }).code.toString()
    } catch {
      return text
    }
  }).join('\n')
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function budgetIssues(theme: InstalledTheme): { errors: ThemeIssue[], warnings: ThemeIssue[] } {
  const errors: ThemeIssue[] = []
  const warnings: ThemeIssue[] = []
  const gzip = gzipSync(themeCss(theme.dir)).length
  if (gzip > MAX_CSS_GZIP_BYTES) errors.push({ kind: 'budget', message: `theme CSS is ${kb(gzip)} gzipped (theme.css, sections.css and slots), the limit is ${kb(MAX_CSS_GZIP_BYTES)}` })

  const fonts = theme.manifest.fonts ?? []
  const families = new Set(fonts.map(font => font.family))
  if (families.size > MAX_FONT_FAMILIES) errors.push({ kind: 'budget', message: `declares ${families.size} font families (${[...families].join(', ')}), the limit is ${MAX_FONT_FAMILIES}` })

  const total = fonts.reduce((sum, font) => {
    const file = join(theme.dir, 'fonts', font.file)
    return sum + (existsSync(file) ? statSync(file).size : 0)
  }, 0)
  if (total > FONT_TOTAL_MAX_BYTES) errors.push({ kind: 'budget', message: `fonts total ${kb(total)}, over the ${kb(FONT_TOTAL_MAX_BYTES)} ceiling` })
  else if (total > FONT_TOTAL_WARN_BYTES) warnings.push({ kind: 'budget', message: `fonts total ${kb(total)}, over the ${kb(FONT_TOTAL_WARN_BYTES)} target (allowed up to ${kb(FONT_TOTAL_MAX_BYTES)})` })
  return { errors, warnings }
}

/** Contract and hooks, contrast and budgets of one installed theme; contrast and budgets run only when the contract holds. */
export function checkTheme(theme: InstalledTheme, hooks: Hooks): ThemeReport {
  const report: ThemeReport = { theme: theme.id, errors: [], warnings: [] }
  const contract = contractProblems(theme.manifest)
  if (contract.length) {
    report.errors.push(...contract.map(message => ({ kind: 'contract' as const, message })))
    return report
  }
  report.errors.push(...themeProblems(theme, hooks).map(message => ({ kind: 'contract' as const, message })))
  for (const { theme: _theme, ...issue } of contrastProblems(theme.manifest)) report.errors.push({ kind: 'contrast', ...issue })
  const budgets = budgetIssues(theme)
  report.errors.push(...budgets.errors)
  report.warnings.push(...budgets.warnings)
  return report
}

/** One line per issue, each naming the theme. */
export function formatIssue(theme: string, issue: ThemeIssue): string {
  if (issue.kind === 'contrast') return issue.message
  return `theme "${theme}": ${issue.message}`
}
