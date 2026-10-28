// `npm run theme:publish -- <step>`: the steps of publishing that `.github/workflows/theme-publish.yml`, `theme-index-prepare.yml` and
// `theme-push-bundle.yml` run (#312, ADR 0008 decision 4). gate: decide from the admission report whether a version may be published and write
// what the workflow pushes; index: make the next index and write the document to sign; verify: check a bundle is the attestation the registry pins before it is pushed; check-base: refuse the write when another index landed meanwhile; listed: fail with the re-run when the index does not list a version the run pushed. docs/themes/publishing-a-theme.md explains them.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { AdmissionReportSchema } from '../modules/theme/admission/report'
import { THEME_ID } from '../modules/theme/constants'
import { ANNOTATIONS } from '../modules/theme/publish/constants'
import { entryFromPackage } from '../modules/theme/publish/entry'
import { publishBlockers } from '../modules/theme/publish/gate'
import { assertBase, assertListed, nextIndex, verifySigned } from '../modules/theme/publish/update'
import type { IndexChange } from '../modules/theme/publish/update'
import { DEFAULT_REGISTRY } from '../modules/theme/registry/constants'
import { identityFor } from '../modules/theme/registry/identity'

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

const sha256 = (data: Uint8Array): string => `sha256:${createHash('sha256').update(data).digest('hex')}`

function gate(): void {
  const id = required('theme')
  if (!THEME_ID.test(id)) throw new Error('--theme is not a theme id')
  const dir = join(required('reports'), id)
  const accessibilityFile = `${required('accessibility-root').replace(/\/$/, '')}/${id}.json`
  const reportBytes = readFileSync(join(dir, 'admission-report.json'))
  const parsed = AdmissionReportSchema.safeParse(JSON.parse(reportBytes.toString('utf8')))
  if (!parsed.success) throw new Error(`the admission report does not match its schema: ${parsed.error.issues[0]?.path.join('.') || 'root'}`)
  const report = parsed.data
  const blockers = publishBlockers(report, id, accessibilityFile)
  if (blockers.length > 0 || !report.package) {
    for (const blocker of blockers) process.stdout.write(`::error::${id}: ${blocker}\n`)
    process.exit(1)
  }
  // The package is the file of the report's own directory, whose name the report gives; its digest must be the report's
  const file = join(dir, report.package.file.replace(/^.*\//, ''))
  const bytes = readFileSync(file)
  if (sha256(bytes) !== report.package.digest) throw new Error(`${file} is not the package the report describes (digest ${sha256(bytes)}, report ${report.package.digest})`)
  const reportDigest = sha256(reportBytes)
  const { version, entry } = entryFromPackage(bytes, report.package.digest, reportDigest)
  if (version !== report.theme.version) throw new Error(`the package is version ${version}, the report says ${report.theme.version}`)
  if (report.accessibility?.status === 'partial') process.stdout.write(`::warning::${id}@${version}: the accessibility record has lines that were not verified; the version is published with the record as it stands\n`)
  const out = required('out')
  writeJson(out, { id, version, package: file, digest: entry.digest, report: join(dir, 'admission-report.json'), reportDigest, contract: entry.contract, license: entry.license, tier: entry.tier, code: entry.code })
  writeJson(`${out}.annotations.json`, {
    $manifest: {
      [ANNOTATIONS.contract]: entry.contract,
      [ANNOTATIONS.license]: entry.license,
      [ANNOTATIONS.tier]: entry.tier,
      [ANNOTATIONS.packageDigest]: entry.digest,
      [ANNOTATIONS.reportDigest]: reportDigest,
    },
  })
  process.stdout.write(`${id}@${version} may be published (${entry.digest}, contract ${entry.contract}, ${entry.license}, code: ${entry.code})\n`)
}

async function index(): Promise<void> {
  const registry = args.registry ?? process.env.MICELIO_THEME_REGISTRY ?? DEFAULT_REGISTRY
  const identity = identityFor(registry)
  if (!identity) throw new Error(`no signer identity is known for ${registry}: set MICELIO_THEME_REGISTRY_IDENTITY`)
  const base = { id: required('theme'), version: required('version') }
  const action = required('action')
  let change: IndexChange
  if (action === 'add') change = { action, ...base, digest: required('digest'), ...(args['report-digest'] ? { reportDigest: args['report-digest'] } : {}) }
  else if (action === 'yank') change = { action, ...base, reason: process.env.YANK_REASON ?? '', at: new Date() }
  else throw new Error('--action is add or yank')
  const next = await nextIndex({ registry, identity, change })
  const out = resolve(required('out'))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, next.document)
  writeJson(`${out}.info`, { digest: next.digest, base: next.base })
  process.stdout.write(`index ${next.digest} (${action} ${base.id}@${base.version}; made from ${next.base ?? 'no index'})\n`)
}

async function checkBase(): Promise<void> {
  const registry = args.registry ?? process.env.MICELIO_THEME_REGISTRY ?? DEFAULT_REGISTRY
  const info = JSON.parse(readFileSync(required('info'), 'utf8')) as { digest?: string, base?: string | null }
  process.stdout.write(`state=${await assertBase({ registry, base: info.base ?? null, ...(info.digest ? { digest: info.digest } : {}) })}\n`)
}

async function listed(): Promise<void> {
  const registry = args.registry ?? process.env.MICELIO_THEME_REGISTRY ?? DEFAULT_REGISTRY
  const identity = identityFor(registry)
  if (!identity) throw new Error(`no signer identity is known for ${registry}: set MICELIO_THEME_REGISTRY_IDENTITY`)
  const [id, version, digest] = [required('theme'), required('version'), required('digest')]
  await assertListed({ registry, identity, id, version, digest, ...(args['report-digest'] ? { reportDigest: args['report-digest'] } : {}) })
  process.stdout.write(`${id}@${version} is in the signed index\n`)
}

function verify(): void {
  const kind = required('kind')
  if (kind !== 'packages' && kind !== 'index') throw new Error('--kind is packages or index')
  const registry = args.registry ?? process.env.MICELIO_THEME_REGISTRY ?? DEFAULT_REGISTRY
  const identity = identityFor(registry)
  if (!identity) throw new Error(`no signer identity is known for ${registry}: set MICELIO_THEME_REGISTRY_IDENTITY`)
  verifySigned(readFileSync(required('bundle')), kind, required('digest'), identity)
  process.stdout.write(`the bundle is the attestation of ${required('digest')} by ${identity[kind]}\n`)
}

try {
  if (step === 'verify') verify()
  else if (step === 'check-base') await checkBase()
  else if (step === 'listed') await listed()
  else if (step === 'gate') gate()
  else if (step === 'index') await index()
  else throw new Error('usage: theme:publish gate|index|verify|check-base|listed (see docs/themes/publishing-a-theme.md)')
} catch (error) {
  process.stdout.write(`::error::${error instanceof Error ? error.message.split('\n')[0] : 'failed'}\n`)
  process.exit(1)
}
