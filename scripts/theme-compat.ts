// `npm run theme:compat -- <step>`: the steps of the theme compatibility check that `.github/workflows/theme-compat.yml` runs (#314).
// plan: which published themes to check against this core, and the commit each was built from; decide: from the admission reports, what blocks the release and what the index marks
// incompatible. docs/themes/publishing-a-theme.md (section 12) explains them.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSignedIndex } from '../modules/theme/publish/update'
import { createRegistry } from '../modules/theme/registry/client'
import { DEFAULT_REGISTRY } from '../modules/theme/registry/constants'
import { identityFor } from '../modules/theme/registry/identity'
import { planThemes, sourceOf } from './theme-compat/plan'
import type { CompatEntry } from './theme-compat/plan'
import { decide, markReason, resultsTable } from './theme-compat/results'

/** Where the themes of the registry are published from (`micelio-themes`): the only repository a provenance may name as the source. */
const DEFAULT_SOURCE_REPOSITORY = 'bogd3v/micelio-themes'
const ROOT = fileURLToPath(new URL('..', import.meta.url))
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

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(resolve(file)), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

interface Plan {
  core: { version: string }
  checked: CompatEntry[]
  unchecked: Array<CompatEntry & { reason: string }>
}

/** The registry and the source repository of its themes. */
function registryAndIdentity(): { registry: string, identity: NonNullable<ReturnType<typeof identityFor>> } {
  const registry = args.registry ?? process.env.MICELIO_THEME_REGISTRY ?? DEFAULT_REGISTRY
  const identity = identityFor(registry)
  if (!identity) throw new Error(`no signer identity is known for ${registry}: set MICELIO_THEME_REGISTRY_IDENTITY`)
  return { registry, identity }
}

/** Reads the signed index and, for the latest non-yanked version of each theme, the commit its verified provenance names. */
async function plan(): Promise<void> {
  const { registry, identity } = registryAndIdentity()
  const source = args.source ?? DEFAULT_SOURCE_REPOSITORY
  const entries = planThemes(await readSignedIndex({ registry, identity }))
  const client = createRegistry({ registry, identity })
  const checked: Array<CompatEntry & { commit: string }> = []
  const unchecked: Array<CompatEntry & { reason: string }> = []
  for (const entry of entries) {
    const { bundle } = await client.fetch({ id: entry.id, version: entry.version, digest: entry.digest }, { locked: true })
    const found = sourceOf(bundle, source)
    if ('reason' in found) unchecked.push({ ...entry, reason: found.reason })
    else checked.push({ ...entry, commit: found.commit })
  }
  const { version } = readJson<{ version: string }>(join(ROOT, 'package.json'))
  writeJson(required('out'), { core: { version }, source, checked, unchecked, matrix: checked.map((entry, n) => ({ n, id: entry.id, commit: entry.commit })) })
  process.stdout.write(`${checked.length} theme(s) to check on micelio ${version}${unchecked.length > 0 ? `; ${unchecked.length} without a source commit: ${unchecked.map(entry => `${entry.id}@${entry.version}`).join(', ')}` : ''}\n`)
}

function decision(): void {
  const planned = readJson<Plan>(required('plan'))
  const dir = required('reports')
  const reports = new Map<string, unknown>()
  for (const entry of planned.checked) {
    try {
      reports.set(entry.id, readJson(join(dir, entry.id, 'admission-report.json')))
    } catch {
      // A report that was never written is a failure the decision reports; nothing is lost here
    }
  }
  const result = decide(planned.checked, planned.unchecked, reports)
  const core = planned.core.version
  // Only a release that publishes proposes marks: its `package.json` holds the version being released. On a released core a failure is a report, never a mark
  const marks = args.marks === 'true'
  const table = resultsTable(result, core, marks)
  writeJson(required('out'), {
    core,
    blocked: result.blocking.length > 0,
    blocking: result.blocking.map(item => ({ theme: item.id, version: item.version, reason: item.reason })),
    incompatible: (marks ? result.incompatible : []).map(item => ({ theme: item.id, version: item.version, core, reason: markReason(item, core) })),
    results: result.results,
  })
  writeFileSync(required('summary'), `${table}\n`)
  process.stdout.write(`${table}\n`)
  for (const item of result.blocking) process.stdout.write(`::error::${item.id}@${item.version} (official) ${item.outcome === 'unchecked' ? 'was not checked' : 'fails on this core'}: ${item.reason.replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ')}\n`)
}

try {
  if (step === 'plan') await plan()
  else if (step === 'decide') decision()
  else throw new Error('usage: theme:compat plan|decide (see docs/themes/publishing-a-theme.md, section 12)')
} catch (error) {
  process.stdout.write(`::error::${error instanceof Error ? error.message.split('\n')[0] : 'failed'}\n`)
  process.exit(1)
}
