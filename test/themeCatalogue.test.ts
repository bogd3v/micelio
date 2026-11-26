import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleReport, reportSummary } from '../modules/theme/admission/collect'
import { AdmissionReportSchema } from '../modules/theme/admission/report'
import { installTheme } from '../modules/theme/install/install'
import { loadBuiltInTheme } from '../server/lib/builtInStore'
import { startThemeSwitch } from '../server/lib/themeSwitch/boot'
import type { StartedSwitch } from '../server/lib/themeSwitch/boot'
import { digestOf, startRegistry, stubBundle, TEST_IDENTITY } from './fixtures/registry'
import type { FakeRegistry } from './fixtures/registry'
import { builtInStore, cleanup, CORE, HOOKS, listing, packaged, scratch, STARTER_PINNED } from './fixtures/themeSwitch'

// The server's own wiring (boot.ts) over a fake registry: the stand-in bundles of the fixtures replace Sigstore's offline verification.
vi.mock('../modules/theme/registry/attestation', async (original) => {
  const actual = await original<typeof import('../modules/theme/registry/attestation')>()
  const { stubVerifier } = await import('./fixtures/registry')
  return { ...actual, verifyBundle: stubVerifier }
})

const IDENTITY = `issuer=${TEST_IDENTITY.issuer},package=${TEST_IDENTITY.packages},index=${TEST_IDENTITY.index}`
const registries: FakeRegistry[] = []

afterEach(async () => {
  await Promise.all(registries.splice(0).map(fake => fake.close()))
  cleanup()
})

async function fakeRegistry(): Promise<FakeRegistry> {
  const fake = await startRegistry()
  registries.push(fake)
  return fake
}

/** The server's switch over the test image's built-in store, a deployment store and the fake registry, with its catalogue refreshed once. */
async function boot(fake: FakeRegistry, env: Record<string, string | undefined> = {}): Promise<StartedSwitch & { builtInDir: string }> {
  const builtInDir = await builtInStore()
  const started = startThemeSwitch({
    builtInDir,
    configured: '',
    env: { MICELIO_THEME_INSTALL: 'false', MICELIO_THEME_REGISTRY: fake.registry, MICELIO_THEME_REGISTRY_IDENTITY: IDENTITY, ...env },
    onSwitch: () => undefined,
    warn: () => undefined,
  })
  await started.ready
  await started.catalogue.refresh()
  return { ...started, builtInDir }
}

/** Installs a data-only package into a deployment store as a server install leaves it: compiled for the test core, with its package and attestation kept. */
async function installed(store: string, id: string, version = '1.0.0'): Promise<{ data: Buffer, digest: string }> {
  const pkg = packaged(id, undefined, version)
  await installTheme({ kind: 'package', data: pkg.data, pin: pkg.pin, attestation: stubBundle(TEST_IDENTITY.packages, pkg.pin.digest.slice(7)) }, { storeDir: store, hooks: HOOKS, coreBuild: CORE, layoutCss: {} })
  return { data: pkg.data, digest: pkg.pin.digest }
}

const d = (text: string): string => digestOf(Buffer.from(text))

/** A valid admission report of `id`@`version`, as its bytes and the digest the index names. */
function report(id: string, version: string, ok = true, message = 'a role is missing'): { bytes: Buffer, digest: string, summary: string } {
  const parsed = AdmissionReportSchema.parse(assembleReport({
    themeId: id,
    staticResult: { theme: { id, version, contract: '2.0', code: false }, errors: ok ? [] : [{ check: 'static', kind: 'contract', message }], warnings: [], package: { file: `${id}-${version}.tgz`, digest: d(id), bytes: 1 } },
    performance: [],
    quality: undefined,
    qualityExpected: false,
    visual: false,
    builds: [],
    core: { repository: 'bogd3v/micelio', ref: 'v0.9.0', sha: 'a'.repeat(40), version: '0.9.0', contract: '2.5' },
    run: null,
    now: new Date('2026-11-25T12:00:00Z'),
  }))
  const bytes = Buffer.from(JSON.stringify(parsed))
  return { bytes, digest: digestOf(bytes), summary: reportSummary(parsed) }
}

/** Publishes a report as the blob of the referrer in the theme's repository. */
function publishReport(fake: FakeRegistry, id: string, bytes: Buffer): void {
  fake.publish(id, `report-${digestOf(bytes).slice(7, 19)}`, bytes, 'application/json', false)
}

describe('the theme catalogue', () => {
  it('lists the themes of the built-in and deployment stores with their contract, code and store', async () => {
    const fake = await fakeRegistry()
    const store = scratch()
    const calm = await installed(store, 'calm')
    fake.publishIndex({ version: 1, themes: { calm: { versions: { '1.0.0': listing(calm.digest, { license: 'MIT', tier: 'verified', report: d('calm report') }) } } } })
    const started = await boot(fake, { MICELIO_THEME_STORE: store })
    const minimal = loadBuiltInTheme(started.builtInDir, 'minimal')
    expect(started.catalogue.current().installed).toEqual([
      { id: 'minimal', version: '', packageDigest: minimal.entry.manifest.packageDigest, contract: minimal.runtime.contract, code: false, store: 'built-in' },
      // The digest the image's lock pins, not the digest of the file tree it was built from
      { id: 'starter', version: '0.1.0', packageDigest: STARTER_PINNED, contract: '2.1', code: true, store: 'built-in' },
      { id: 'calm', version: '1.0.0', packageDigest: calm.digest, contract: '2.1', code: false, store: 'deployment', tier: 'verified', license: 'MIT', report: d('calm report') },
    ])
  })

  it('lists the registry\'s versions with runs set by the core\'s contract and the incompatible mark, and licensed ones without a download', async () => {
    const fake = await fakeRegistry()
    fake.publishIndex({
      version: 1,
      themes: {
        sample: {
          versions: {
            '1.0.0': listing(d('a')),
            '1.1.0': listing(d('b'), { status: 'incompatible' }),
            '1.2.0': listing(d('c'), { status: 'incompatible', incompatible: { core: '0.1.0', reason: 'breaks the header', at: '2026-11-01T00:00:00Z' } }),
            '1.3.0': listing(d('e'), { contract: '3.0' }),
            '1.4.0': listing(d('f'), { contract: '2.9' }),
            '1.5.0': listing(d('g'), { status: 'yanked', yank: { reason: 'wrong colours', at: '2026-11-02T00:00:00Z' }, report: d('g report') }),
          },
        },
        paid: { versions: { '2.0.0': listing(d('p'), { distribution: 'licensed', license: 'LicenseRef-Paid', tier: 'community', code: true }) } },
      },
    })
    const catalogue = (await boot(fake)).catalogue.current()
    expect(catalogue.reason).toBeNull()
    expect(catalogue.registry).toEqual([
      { id: 'paid', versions: [{ version: '2.0.0', digest: d('p'), contract: '2.0', license: 'LicenseRef-Paid', tier: 'community', distribution: 'licensed', status: 'published', code: true, runs: true }] },
      {
        id: 'sample',
        versions: [
          { version: '1.5.0', digest: d('g'), contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'yanked', code: false, report: d('g report'), runs: true },
          { version: '1.4.0', digest: d('f'), contract: '2.9', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false, runs: false },
          { version: '1.3.0', digest: d('e'), contract: '3.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false, runs: false },
          // The server passes no core version, so a version marked incompatible from any core on does not run here
          { version: '1.2.0', digest: d('c'), contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'incompatible', code: false, runs: false },
          { version: '1.1.0', digest: d('b'), contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'incompatible', code: false, runs: false },
          { version: '1.0.0', digest: d('a'), contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false, runs: true },
        ],
      },
    ])
    // Reading the catalogue fetched the index and nothing of any package
    expect(fake.seen.filter(seen => !seen.path.includes('/index/'))).toEqual([])
  })

  it('lists as an update the newest published version that runs on this core, and nothing else', async () => {
    const fake = await fakeRegistry()
    const store = scratch()
    const calm = await installed(store, 'calm')
    fake.publishIndex({
      version: 1,
      themes: {
        calm: {
          versions: {
            '0.9.0': listing(d('old')),
            '1.0.0': listing(calm.digest),
            '1.1.0': listing(d('next')),
            '1.2.0': listing(d('contract'), { contract: '3.0' }),
            '1.3.0': listing(d('yanked'), { status: 'yanked' }),
            '1.4.0': listing(d('incompatible'), { status: 'incompatible' }),
          },
        },
        // A theme of the image the registry also lists: an update of the built-in starter, by its version alone
        starter: { versions: { '0.1.0': listing(d('starter 0.1.0')), '0.2.0': listing(d('starter 0.2.0'), { status: 'yanked' }) } },
        other: { versions: { '5.0.0': listing(d('other')) } },
      },
    })
    expect((await boot(fake, { MICELIO_THEME_STORE: store })).catalogue.current().updates).toEqual([
      { id: 'calm', from: '1.0.0', store: 'deployment', version: '1.1.0', digest: d('next') },
    ])
  })

  it('uses a report only when its bytes match the report digest of the index, and at most 50', async () => {
    const fake = await fakeRegistry()
    const store = scratch()
    const calm = await installed(store, 'calm')
    const calmReport = report('calm', '1.0.0')
    // A message of the admission run that names a file of its runner and a URL with a query
    const failed = report('calm', '1.1.0', false, 'fonts/a.woff2 failed in /home/runner/work/calm/theme.css, see https://example.test/run/1?token=abc')
    const tampered = report('sample', '1.0.0')
    const notAReport = Buffer.from(JSON.stringify({ ok: true }))
    publishReport(fake, 'calm', calmReport.bytes)
    publishReport(fake, 'calm', failed.bytes)
    publishReport(fake, 'sample', tampered.bytes)
    fake.tamper(tampered.digest, Buffer.from(tampered.bytes.toString('utf8').replace('"ok":true', '"ok":false')))
    publishReport(fake, 'broken', notAReport)
    fake.publishIndex({
      version: 1,
      themes: {
        // The report of the installed version, the newest published version's, and none for a yanked one
        calm: { versions: { '1.0.0': listing(calm.digest, { report: calmReport.digest }), '1.1.0': listing(d('calm 1.1.0'), { report: failed.digest }), '1.2.0': listing(d('calm 1.2.0'), { status: 'yanked', report: d('yanked report') }) } },
        sample: { versions: { '1.0.0': listing(d('sample'), { report: tampered.digest }) } },
        broken: { versions: { '1.0.0': listing(d('broken'), { report: digestOf(notAReport) }) } },
        odd: { versions: { '1.0.0': listing(d('odd'), { report: '../../etc/passwd' }) } },
      },
    })
    const catalogue = (await boot(fake, { MICELIO_THEME_STORE: store })).catalogue.current()
    expect(catalogue.reports).toEqual([
      { id: 'calm', version: '1.0.0', digest: calmReport.digest, ok: true, summary: calmReport.summary },
      { id: 'calm', version: '1.1.0', digest: failed.digest, ok: false, summary: failed.summary.replace('/home/runner/work/calm/theme.css', '<path>').replace('?token=abc', '') },
    ])
    expect(catalogue.reports[1]?.summary).toContain('fonts/a.woff2 failed in <path>, see https://example.test/run/1')
    // A report digest that is not a digest never reaches a URL or the catalogue
    expect(fake.seen.some(seen => seen.path.includes('passwd'))).toBe(false)
    expect(JSON.stringify(catalogue)).not.toContain('passwd')

    const crowded = await fakeRegistry()
    const many: Record<string, { versions: Record<string, unknown> }> = {}
    for (let n = 0; n < 60; n++) {
      const id = `many-${String(n).padStart(2, '0')}`
      const own = report(id, '1.0.0')
      publishReport(crowded, id, own.bytes)
      many[id] = { versions: { '1.0.0': listing(d(id), { report: own.digest }) } }
    }
    crowded.publishIndex({ version: 1, themes: many })
    const reports = (await boot(crowded)).catalogue.current().reports
    expect(reports.map(read => read.id)).toEqual(Object.keys(many).slice(0, 50))
    // The reports past the cap are never asked for
    expect(crowded.seen.filter(seen => seen.path.includes('/blobs/') && !seen.path.includes('/index/'))).toHaveLength(50)
  })

  it('keeps the last good catalogue and a reason without URL or path when the index fails or does not verify', async () => {
    const fake = await fakeRegistry()
    fake.publishIndex({ version: 1, themes: { calm: { versions: { '1.0.0': listing(d('calm')) } } } })
    const started = await boot(fake)
    const good = started.catalogue.current().registry
    expect(good?.map(theme => theme.id)).toEqual(['calm'])

    // An index signed by someone else is never used
    fake.publishIndex({ version: 1, themes: { planted: { versions: { '1.0.0': listing(d('planted')) } } } }, 'https://attacker.example.test/sign.yml@refs/heads/main')
    await started.catalogue.refresh()
    const unverified = started.catalogue.current()
    expect(unverified.registry).toEqual(good)
    expect(unverified.reason).toMatch(/did not verify/)
    expect(unverified.reason).not.toMatch(/https?:|\/|127\.0\.0\.1/)

    // A registry that fails
    fake.fail('/v2/micelio-themes/index/manifests/v1', 500)
    await started.catalogue.refresh()
    const failing = started.catalogue.current()
    expect(failing.registry).toEqual(good)
    expect(failing.reason).toMatch(/could not be read/)
    expect(failing.reason).not.toMatch(/https?:|\/|127\.0\.0\.1/)

    // With no good read yet, there is no registry to keep
    const down = await fakeRegistry()
    const never = (await boot(down)).catalogue.current()
    expect(never.registry).toBeNull()
    expect(never.reason).toMatch(/could not be read \(not-found\)/)
    expect(never.reason).not.toMatch(/https?:|\/|127\.0\.0\.1/)
  })

  it('reads nothing from a non-default registry without its signer identity', async () => {
    const fake = await fakeRegistry()
    fake.publishIndex({ version: 1, themes: { calm: { versions: { '1.0.0': listing(d('calm')) } } } })
    for (const env of [{ MICELIO_THEME_REGISTRY_IDENTITY: undefined }, { MICELIO_THEME_REGISTRY_IDENTITY: undefined, MICELIO_THEME_STORE: scratch() }]) {
      const catalogue = (await boot(fake, env)).catalogue.current()
      expect(catalogue.registry).toBeNull()
      expect(catalogue.reason).toMatch(/MICELIO_THEME_REGISTRY_IDENTITY is not set/)
      expect(catalogue.installed.map(theme => theme.id)).toEqual(['minimal', 'starter'])
      expect(catalogue.updates).toEqual([])
      expect(catalogue.reports).toEqual([])
    }
    expect(fake.seen).toEqual([])
  })
})
