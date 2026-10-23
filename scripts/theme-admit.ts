// `npm run theme:admit -- <step>`: the steps of theme admission that `.github/workflows/theme-admission.yml` runs (#311, ADR 0008 decision 5).
// plan: which themes, builds and site modes; static: `theme:check` and `theme:pack` as JSON; install: put a data-only theme into an existing
// core build; build-info: record a build made with the theme; report: assemble admission-report.json. docs/themes/publishing-a-theme.md explains them.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleReport, reportSummary } from '../modules/theme/admission/collect'
import type { PerformanceInput } from '../modules/theme/admission/collect'
import { hasCode, ownBuildReason } from '../modules/theme/admission/plan'
import { checkTheme, formatIssue } from '../modules/theme/check'
import { CONTRACT_VERSION, THEME_ID } from '../modules/theme/constants'
import { loadHooks } from '../modules/theme/hooks'
import { BUILT_IN_INDEX, BUILT_IN_STORE_PATH } from '../modules/theme/install/constants'
import { installTheme } from '../modules/theme/install/install'
import type { BuiltInIndex } from '../modules/theme/install/types'
import { buildPackage, writePackage } from '../modules/theme/registry/build'
import { discoverThemes, themeRoots } from '../modules/theme/themes'
import type { InstalledTheme } from '../modules/theme/types'
import { formatContractVersion } from '../modules/theme/version'
import { loadDefaultTheme } from '../server/lib/builtInStore'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// The neutral data-only theme (one mode, no slots, default layout) the shared core build is made with: a theme with the same id replaces it
// in that build's store, which is what the server would do. TODO(#402): once slots and layout variants load at runtime, the shared build is the default theme's
const BASE_THEME = 'minimal'
const BASE_THEME_DIR = 'test/fixtures/themes/minimal'

const [step, ...rest] = process.argv.slice(2)
const args = parseArgs(rest)

function parseArgs(list: string[]): Record<string, string> {
  const parsed: Record<string, string> = {}
  for (let i = 0; i < list.length; i++) {
    const key = list[i]!.replace(/^--/, '')
    const next = list[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      parsed[key] = next
      i++
    } else parsed[key] = 'true'
  }
  return parsed
}

function required(name: string): string {
  const value = args[name]
  if (!value || value === 'true') throw new Error(`--${name} is required`)
  return value
}

function readJson(file: string): unknown {
  if (!existsSync(file)) return undefined
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined // A file cut by a crashed job: the report counts it as missing
  }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(resolve(file, '..'), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

/** A JSON array of strings from an input, or undefined when blank. */
function listInput(name: string): string[] | undefined {
  const raw = (args[name] ?? '').trim()
  if (!raw || raw === 'true') return undefined
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) throw new Error(`--${name} must be a JSON array of strings, got ${raw}`)
  return parsed
}

/** The themes to admit: the ids given, or every theme under `MICELIO_THEME_DIRS`. */
function themesToAdmit(): InstalledTheme[] {
  const installed = discoverThemes(themeRoots(ROOT))
  const ids = listInput('themes')
  if (ids) {
    return ids.map((id) => {
      const theme = installed.find(candidate => candidate.id === id)
      if (!theme) throw new Error(`Theme "${id}" is not installed (installed: ${installed.map(candidate => candidate.id).join(', ')})`)
      return theme
    })
  }
  const core = themeRoots(ROOT, '')
  const extra = discoverThemes(themeRoots(ROOT).filter(root => !core.includes(root)))
  if (!extra.length) throw new Error('No theme to admit: MICELIO_THEME_DIRS names no theme folder, and --themes is empty')
  return extra
}

/** Plan: the matrix of every job, written as one JSON line for `$GITHUB_OUTPUT`. */
function plan(): void {
  const themes = themesToAdmit()
  const [base] = discoverThemes([join(ROOT, BASE_THEME_DIR)])
  const budgets = JSON.parse(readFileSync(join(ROOT, 'scripts/perf/budgets.json'), 'utf8')) as { modes: Record<string, { ci?: boolean }> }
  const known = Object.keys(budgets.modes).filter(mode => budgets.modes[mode]!.ci !== false)
  const modes = listInput('modes') ?? known
  if (!modes.length) throw new Error('--modes is empty: name at least one site mode, or leave it blank for every mode')
  const unknown = modes.filter(mode => !known.includes(mode))
  if (unknown.length) throw new Error(`Unknown site modes ${unknown.join(', ')}; the core measures ${known.join(', ')}`)
  const heaviest = args['display-font'] !== 'false'
  // Baselines live outside the theme folder, which the package must not include: <snapshot-root>/<id>/<mode>/<viewport>/
  const snapshotRoot = args['snapshot-root'] && args['snapshot-root'] !== 'true' ? args['snapshot-root'] : 'e2e/theme/__screenshots__'
  const planned = themes.map((theme) => {
    const reason = ownBuildReason(theme, base!)
    return { id: theme.id, build: reason ? 'own' : 'shared', ...(reason && { reason }) }
  })
  const performance = planned.flatMap(theme => modes.flatMap(mode => ['default', ...(heaviest && mode === 'dynamic' ? ['heaviest'] : [])].map(font => ({ theme: theme.id, mode, font, build: theme.build, ...(theme.reason && { reason: theme.reason }) }))))
  const quality = args.quality === 'false' ? [] : planned.map(theme => ({ theme: theme.id, build: theme.build, snapshots: `${snapshotRoot}/${theme.id}`, ...(theme.reason && { reason: theme.reason }) }))
  const anyShared = planned.some(theme => theme.build === 'shared')
  const sharedBuilds = [
    ...(anyShared && performance.some(run => run.mode === 'dynamic' && run.build === 'shared') ? ['performance'] : []),
    ...(anyShared && quality.some(entry => entry.build === 'shared') ? ['quality'] : []),
  ]
  const result = { themes: planned, performance, quality, modes, sharedBuilds, baseTheme: BASE_THEME, baseThemeDir: BASE_THEME_DIR }
  if (args.out) writeJson(args.out, result)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

/** The package `theme:pack` makes, written to `.micelio/packages/`, or the reason it cannot be made. */
function packTheme(theme: InstalledTheme, hooks: ReturnType<typeof loadHooks>): { pack?: { file: string, digest: string, bytes: number }, packError?: string } {
  try {
    const built = buildPackage(theme, hooks)
    const written = writePackage(built, ROOT)
    process.stdout.write(`${built.tgzName}: ${built.digest}\n  ${written.tgz}\n`)
    return { pack: { file: built.tgzName, digest: built.digest, bytes: built.tgz.length } }
  } catch (error) {
    return { packError: `theme:pack: ${(error as Error).message}` }
  }
}

/** Static: the `theme:check` issues with the messages it prints, and the package `theme:pack` makes. */
function staticStep(): void {
  const id = required('theme')
  const theme = discoverThemes(themeRoots(ROOT)).find(candidate => candidate.id === id)
  if (!theme) throw new Error(`Theme "${id}" is not installed`)
  const hooks = loadHooks(join(ROOT, 'app'))
  const report = checkTheme(theme, hooks)
  const issue = (item: (typeof report.errors)[number]): { kind: string, message: string } => ({ kind: item.kind, message: formatIssue(report.theme, item) })
  // A theme with errors cannot be packed for the same reasons: no second copy of them
  const { pack, packError } = report.errors.length ? {} : packTheme(theme, hooks)
  const contract = typeof theme.manifest.contract === 'number' ? `${theme.manifest.contract}.0` : typeof theme.manifest.contract === 'string' ? theme.manifest.contract : null
  const result = {
    theme: { id, version: typeof theme.manifest.version === 'string' ? theme.manifest.version : null, contract, code: hasCode(theme) },
    errors: report.errors.map(issue),
    warnings: report.warnings.map(issue),
    ...(pack && { package: pack }),
    ...(packError && { packError }),
  }
  writeJson(required('out'), result)
  for (const item of result.errors) process.stdout.write(`  error: ${item.message}\n`)
  for (const item of result.warnings) process.stdout.write(`  warning: ${item.message}\n`)
  if (packError) process.stdout.write(`  error: ${packError}\n`)
}

function storeOf(output: string): string {
  return join(resolve(ROOT, output), 'server', BUILT_IN_STORE_PATH)
}

function readIndex(store: string): BuiltInIndex {
  const file = join(store, BUILT_IN_INDEX)
  if (!existsSync(file)) throw new Error(`${file} is missing: the output folder is not a core build`)
  return JSON.parse(readFileSync(file, 'utf8')) as BuiltInIndex
}

/**
 * Install: adds a data-only theme to the built-in store of an existing build, at that build's compile key, as the server would load it.
 * It runs the checks of the build (contract, public hooks, package): contrast and the static budgets are reported by `static`, so one
 * run reports every problem of a theme instead of stopping at the first.
 */
async function install(): Promise<void> {
  const id = required('theme')
  if (!THEME_ID.test(id)) throw new Error(`Invalid theme id "${id}"`)
  const store = storeOf(required('output'))
  const index = readIndex(store)
  const theme = discoverThemes(themeRoots(ROOT)).find(candidate => candidate.id === id)
  if (!theme) throw new Error(`Theme "${id}" is not installed`)
  const record = { purpose: required('purpose'), kind: 'shared', coreBuild: index.coreBuild, baseTheme: index.buildTheme }
  try {
    const result = await installTheme({ kind: 'folder', dir: theme.dir }, { storeDir: store, hooks: loadHooks(join(ROOT, 'app')), coreBuild: index.coreBuild, buildChecksOnly: true })
    for (const warning of result.warnings) process.stdout.write(`warning: ${warning}\n`)
    index.themes[id] = { digest: result.digest, version: result.manifest.version, code: result.manifest.code }
    writeFileSync(join(store, BUILT_IN_INDEX), JSON.stringify(index))
    // What the server does at boot with NUXT_PUBLIC_THEME=<id>: fails here, with its own message, when it would fail there
    loadDefaultTheme(store, id)
  } catch (error) {
    // The report quotes the reason instead of only "see the job log"
    writeJson(required('out'), { ...record, error: `Installing "${id}" into the shared build failed: ${(error as Error).message}` })
    throw error
  }
  writeJson(required('out'), record)
  process.stdout.write(`Installed "${id}" (${result.digest}) into core build ${index.coreBuild}, made with "${index.buildTheme}"\n`)
}

/** Build-info: records a build made with the theme itself. */
function buildInfo(): void {
  const index = readIndex(storeOf(required('output')))
  writeJson(required('out'), { purpose: required('purpose'), kind: 'own', coreBuild: index.coreBuild, ...(args.reason && { reason: args.reason }) })
}

/** Report: reads what the jobs wrote under `--dir` (laid out by the workflow) and writes the report. Exit 1 on an error with `--strict`. */
function report(): void {
  const id = required('theme')
  const dir = resolve(required('dir'))
  const planned = readJson(required('plan')) as { performance: { theme: string, mode: string, font: PerformanceInput['font'] }[], quality: { theme: string }[] }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
  const builds = (existsSync(dir) ? readdirSync(dir) : []).filter(file => /^build-[a-z0-9-]+\.json$/.test(file)).sort().map(file => readJson(join(dir, file))).filter(Boolean)
  const env = process.env
  const result = assembleReport({
    themeId: id,
    staticResult: readJson(join(dir, 'static.json')),
    performance: planned.performance.filter(run => run.theme === id).map(run => ({ mode: run.mode, font: run.font, result: readJson(join(dir, `perf-${run.mode}-${run.font}.json`)) })),
    quality: readJson(join(dir, 'quality.json')),
    qualityExpected: planned.quality.some(entry => entry.theme === id),
    visual: args.visual !== 'false',
    builds,
    core: { repository: required('core-repository'), ref: required('core-ref'), sha: required('core-sha'), version: pkg.version, contract: formatContractVersion(CONTRACT_VERSION) },
    run: env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null,
    now: new Date(),
  })
  writeJson(required('out'), result)
  const summary = reportSummary(result)
  process.stdout.write(summary)
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  if (args.strict === 'true' && !result.ok) process.exitCode = 1
}

try {
  if (step === 'plan') plan()
  else if (step === 'static') staticStep()
  else if (step === 'install') await install()
  else if (step === 'build-info') buildInfo()
  else if (step === 'report') report()
  else throw new Error('Usage: npm run theme:admit -- plan|static|install|build-info|report [options] (docs/themes/publishing-a-theme.md)')
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
