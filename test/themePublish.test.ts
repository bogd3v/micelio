import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { assembleReport } from '../modules/theme/admission/collect'
import type { ReportInput } from '../modules/theme/admission/collect'
import { ACCESSIBILITY_LINES, AdmissionReportSchema } from '../modules/theme/admission/report'
import { ANNOTATIONS, PUBLISH_TIER, REPORT_ARTIFACT_TYPE } from '../modules/theme/publish/constants'
import { entryFromPackage } from '../modules/theme/publish/entry'
import { PublishError } from '../modules/theme/publish/error'
import { publishBlockers } from '../modules/theme/publish/gate'
import { addVersion, EMPTY_INDEX, serializeIndex, successorProblems, yankVersion } from '../modules/theme/publish/index-edit'
import { assertBase, assertListed, nextIndex, verifySigned } from '../modules/theme/publish/update'
import { createRegistry } from '../modules/theme/registry/client'
import { ATTESTATION_TAG_SUFFIX, BUNDLE_MEDIA_TYPE, DEFAULT_SIGNER, INDEX_MEDIA_TYPE, INDEX_REPOSITORY, INDEX_TAG, PACKAGE_MEDIA_TYPE } from '../modules/theme/registry/constants'
import type { RegistryError } from '../modules/theme/registry/error'
import { parseIndex } from '../modules/theme/registry/registry-index'
import type { IndexVersion } from '../modules/theme/registry/types'
import { digestOf, startRegistry, stubBundle, stubVerifier, TEST_IDENTITY } from './fixtures/registry'
import type { FakeRegistry } from './fixtures/registry'
import { packageOf } from './fixtures/tar'

const THEME = { id: 'calm', name: 'Calm', version: '1.0.0', license: 'AGPL-3.0-only', contract: '2.0' }
const BODY = packageOf({ 'theme.json': JSON.stringify(THEME), 'theme.css': 'a{}' })
const DIGEST = digestOf(BODY)
const AT = new Date('2026-10-28T12:00:00Z')

const lines = Object.fromEntries(ACCESSIBILITY_LINES.map(line => [line, { result: 'pass' }]))
const RECORD = { version: '1.0.0', date: '2026-10-20', by: 'A maintainer', lines }

function reportOf(extra: Partial<ReportInput['staticResult'] & object> = {}, accessibility: unknown = RECORD): ReturnType<typeof assembleReport> {
  const staticResult = {
    theme: { id: 'calm', version: '1.0.0', contract: '2.0', code: false },
    errors: [],
    warnings: [],
    package: { file: 'calm-1.0.0.tgz', digest: DIGEST, bytes: BODY.length },
    accessibilityFile: 'accessibility/calm.json',
    ...(accessibility === null ? {} : { accessibility }),
    ...extra,
  }
  const report = assembleReport({
    themeId: 'calm',
    staticResult,
    performance: [],
    quality: undefined,
    qualityExpected: false,
    visual: false,
    builds: [],
    core: { repository: 'bogd3v/micelio', ref: 'v0.5.1', sha: 'a'.repeat(40), version: '0.5.1', contract: '2.0' },
    run: null,
    now: new Date('2026-10-28T12:00:00Z'),
  })
  return AdmissionReportSchema.parse(report)
}

const blockers = (report: ReturnType<typeof reportOf>, id = 'calm'): string[] => publishBlockers(report, id, 'accessibility/calm.json')

function entry(fields: Partial<IndexVersion> = {}): IndexVersion {
  return { digest: DIGEST, contract: '2.0', license: 'AGPL-3.0-only', tier: 'official', distribution: 'public', status: 'published', code: false, ...fields }
}

function failureOf(run: () => unknown): Error {
  try {
    run()
  } catch (error) {
    return error as Error
  }
  throw new Error('expected an error')
}

describe('what publishing requires of the admission report', () => {
  it('lets a version through whose record is current and passed', () => {
    expect(blockers(reportOf())).toEqual([])
  })

  it('lets a partial record through: lines not verified do not block', () => {
    const partial = { ...RECORD, lines: { ...lines, 'screen-reader.names': { result: 'not-verified', note: 'no screen reader yet' } } }
    const report = reportOf({}, partial)
    expect(report.accessibility?.status).toBe('partial')
    expect(blockers(report)).toEqual([])
  })

  it('blocks a version with no record and names the record', () => {
    const report = reportOf({}, null)
    expect(report.ok).toBe(true)
    expect(blockers(report)).toEqual([expect.stringMatching(/no valid manual accessibility record \(accessibility\/calm\.json\)/)])
  })

  it('blocks a record of another version, naming both versions', () => {
    expect(blockers(reportOf({}, { ...RECORD, version: '0.9.0' }))).toEqual([expect.stringMatching(/accessibility\/calm\.json\) is for version 0\.9\.0, not for 1\.0\.0/)])
  })

  it('blocks a record with a failed line', () => {
    const failed = { ...RECORD, lines: { ...lines, 'keyboard.order': { result: 'fail', issue: 'https://github.com/example/calm/issues/7' } } }
    expect(blockers(reportOf({}, failed))).toEqual([expect.stringMatching(/has a failed line/)])
  })

  it('blocks a failed line whose cause is the theme, said or by default, and names the line', () => {
    const issue = 'https://github.com/example/calm/issues/7'
    for (const cause of [{}, { cause: 'theme' }]) {
      const failed = { ...RECORD, lines: { ...lines, 'keyboard.order': { result: 'fail', issue, ...cause } } }
      expect(blockers(reportOf({}, failed))).toEqual([expect.stringMatching(/has a failed line \(keyboard\.order\)/)])
    }
  })

  it('lets a failed line through whose cause is the core with an issue of bogd3v/micelio, and keeps it in the report', () => {
    const issue = 'https://github.com/bogd3v/micelio/issues/617'
    const record = { ...RECORD, lines: { ...lines, 'keyboard.focus-visible': { result: 'fail', cause: 'core', issue } } }
    const report = reportOf({}, record)
    expect(report.ok).toBe(true)
    expect(report.accessibility?.status).toBe('passed-with-core-failures')
    expect(report.accessibility?.record.lines['keyboard.focus-visible']).toMatchObject({ cause: 'core', issue })
    expect(report.warnings.map(warning => warning.message)).toContain(`keyboard.focus-visible failed because of the core (${issue})`)
    expect(blockers(report)).toEqual([])
  })

  it('still blocks on the theme\'s failure when a core failure sits beside it', () => {
    const core = { result: 'fail', cause: 'core', issue: 'https://github.com/bogd3v/micelio/issues/617' }
    const record = { ...RECORD, lines: { ...lines, 'keyboard.focus-visible': core, 'zoom.200': { result: 'fail', issue: 'https://github.com/example/calm/issues/9' } } }
    expect(blockers(reportOf({}, record))).toEqual([expect.stringMatching(/has a failed line \(zoom\.200\)/)])
  })

  it('makes a core failure with an issue outside bogd3v/micelio, or a lookalike URL, an error of the record', () => {
    for (const issue of ['https://github.com/example/calm/issues/7', 'https://github.com/bogd3v/micelio-cms/issues/7', 'https://github.com/bogd3v/micelio/pull/7', 'https://github.com/bogd3v/micelio/issues/7#x', 'https://github.com.evil.test/bogd3v/micelio/issues/7']) {
      const report = reportOf({}, { ...RECORD, lines: { ...lines, 'keyboard.order': { result: 'fail', cause: 'core', issue } } })
      expect(report.ok, issue).toBe(false)
      expect(report.errors[0]!.message).toMatch(/keyboard\.order\.issue: a failure with cause "core" must link an issue in bogd3v\/micelio/)
      expect(blockers(report).join('\n')).toMatch(/admission found 1 error/)
    }
  })

  it('makes a core failure without an issue, or a cause that is neither, an error of the record', () => {
    for (const line of [{ result: 'fail', cause: 'core' }, { result: 'fail', cause: 'both', issue: 'https://github.com/bogd3v/micelio/issues/1' }, { result: 'pass', cause: 'core' }]) {
      expect(reportOf({}, { ...RECORD, lines: { ...lines, 'keyboard.order': line } }).ok).toBe(false)
    }
  })

  it('blocks a record that is not valid, through the report\'s own error', () => {
    const report = reportOf({}, { ...RECORD, lines: {} })
    expect(report.ok).toBe(false)
    expect(blockers(report).join('\n')).toMatch(/admission found \d+ errors?/)
  })

  it('blocks a report of another theme, one with no version and one without a package', () => {
    expect(blockers(reportOf(), 'other')[0]).toMatch(/is for "calm", not for "other"/)
    expect(blockers(reportOf({ theme: { id: 'calm', version: null, contract: '2.0', code: false } })).join('\n')).toMatch(/no "version"/)
    expect(blockers(reportOf({ package: undefined })).join('\n')).toMatch(/was not packed/)
  })
})

describe('the entry of a package', () => {
  it('is derived from the package: license and contract from theme.json, code from the files, tier official', () => {
    expect(entryFromPackage(BODY, DIGEST, `sha256:${'c'.repeat(64)}`)).toEqual({
      id: 'calm',
      version: '1.0.0',
      entry: entry({ report: `sha256:${'c'.repeat(64)}` }),
    })
    const withCode = packageOf({ 'theme.json': JSON.stringify(THEME), 'templates/page.vue': '<template><p /></template>' })
    expect(entryFromPackage(withCode, digestOf(withCode)).entry.code).toBe(true)
  })

  it('refuses bytes that are not the digest, a package without a license and one that does not unpack', () => {
    expect(failureOf(() => entryFromPackage(BODY, `sha256:${'0'.repeat(64)}`))).toBeInstanceOf(PublishError)
    const noLicense = packageOf({ 'theme.json': JSON.stringify({ ...THEME, license: undefined }) })
    expect(failureOf(() => entryFromPackage(noLicense, digestOf(noLicense))).message).toMatch(/no "license"/)
    expect(failureOf(() => entryFromPackage(Buffer.from('nope'), digestOf(Buffer.from('nope')))).message).toMatch(/does not unpack/)
  })
})

describe('changing the index', () => {
  it('adds a version and refuses to add one that exists, whatever its status', () => {
    const one = addVersion(EMPTY_INDEX, 'calm', '1.0.0', entry())
    expect(Object.keys(one.themes.calm!.versions)).toEqual(['1.0.0'])
    expect(failureOf(() => addVersion(one, 'calm', '1.0.0', entry())).message).toMatch(/already published/)
    const yanked = yankVersion(one, 'calm', '1.0.0', 'broken fonts', AT)
    expect(failureOf(() => addVersion(yanked, 'calm', '1.0.0', entry())).message).toMatch(/already published/)
    expect(Object.keys(addVersion(one, 'calm', '1.1.0', entry()).themes.calm!.versions)).toEqual(['1.0.0', '1.1.0'])
  })

  it('refuses ids and versions that are not names, and the id of the index', () => {
    for (const [id, version] of [['index', '1.0.0'], ['__proto__', '1.0.0'], ['Calm', '1.0.0'], ['calm', '1.0'], ['calm', 'latest'], ['calm', 'v1.0.0']]) {
      expect(failureOf(() => addVersion(EMPTY_INDEX, id!, version!, entry()))).toBeInstanceOf(PublishError)
    }
  })

  it('yanks a published version with the reason and the time, and only that', () => {
    const one = addVersion(EMPTY_INDEX, 'calm', '1.0.0', entry())
    const yanked = yankVersion(one, 'calm', '1.0.0', '  broken fonts  ', AT)
    expect(yanked.themes.calm!.versions['1.0.0']).toEqual(entry({ status: 'yanked', yank: { reason: 'broken fonts', at: '2026-10-28T12:00:00.000Z' } }))
    expect(one.themes.calm!.versions['1.0.0']!.status).toBe('published')
    expect(failureOf(() => yankVersion(yanked, 'calm', '1.0.0', 'again', AT)).message).toMatch(/is yanked, not published/)
    expect(failureOf(() => yankVersion(one, 'calm', '2.0.0', 'x', AT)).message).toMatch(/not in the index/)
    for (const reason of ['', '   ', 'two\nlines', 'x'.repeat(501)]) {
      expect(failureOf(() => yankVersion(one, 'calm', '1.0.0', reason, AT)).message).toMatch(/needs a reason of one line/)
    }
  })

  it('accepts as a successor only additions of official published versions and yanks', () => {
    const one = addVersion(EMPTY_INDEX, 'calm', '1.0.0', entry())
    expect(successorProblems(EMPTY_INDEX, one)).toEqual([])
    expect(successorProblems(one, addVersion(one, 'calm', '1.1.0', entry()))).toEqual([])
    expect(successorProblems(one, yankVersion(one, 'calm', '1.0.0', 'broken', AT))).toEqual([])
    expect(successorProblems(one, EMPTY_INDEX)).toEqual(['calm@1.0.0 was removed'])
    expect(successorProblems(one, addVersion(EMPTY_INDEX, 'calm', '1.0.0', entry({ code: true })))).toEqual(['calm@1.0.0 was changed'])
    const reverted = { ...one, themes: { calm: { versions: { '1.0.0': entry({ status: 'incompatible' }) } } } }
    expect(successorProblems(one, reverted)).toEqual(['calm@1.0.0 was changed'])
    const yanked = yankVersion(one, 'calm', '1.0.0', 'broken', AT)
    expect(successorProblems(yanked, one)).toEqual(['calm@1.0.0 was changed'])
    for (const bad of [entry({ tier: 'community' }), entry({ distribution: 'licensed' }), entry({ status: 'yanked' })]) {
      expect(successorProblems(one, addVersion(one, 'calm', '1.1.0', bad))).toEqual(['calm@1.1.0 is new and not an official, public, published version'])
    }
  })

  it('writes the same bytes whatever the order, in a form a client reads, and refuses an index too large to read', () => {
    const a = addVersion(addVersion(EMPTY_INDEX, 'zeta', '1.0.0', entry()), 'calm', '1.0.0', entry())
    const b = addVersion(addVersion(EMPTY_INDEX, 'calm', '1.0.0', entry()), 'zeta', '1.0.0', entry())
    expect(serializeIndex(a)).toBe(serializeIndex(b))
    expect(serializeIndex(a).endsWith('}\n')).toBe(true)
    expect(parseIndex(serializeIndex(a))).toEqual(a)
    const versions = (n: number): Record<string, IndexVersion> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`1.0.${i}`, entry({ license: 'x'.repeat(100) })]))
    const big = { version: 1 as const, themes: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`theme-${i}`, { versions: versions(1000) }])) }
    expect(failureOf(() => serializeIndex(big)).message).toMatch(/larger than the \d+ bytes a client reads/)
  })

  it('reads the yank fields back in the client\'s schema', () => {
    const yanked = yankVersion(addVersion(EMPTY_INDEX, 'calm', '1.0.0', entry()), 'calm', '1.0.0', 'broken', AT)
    expect(parseIndex(serializeIndex(yanked)).themes.calm!.versions['1.0.0']!.yank).toEqual({ reason: 'broken', at: '2026-10-28T12:00:00.000Z' })
  })
})

describe('publishing and yanking against a registry', () => {
  const started: FakeRegistry[] = []
  afterEach(async () => {
    await Promise.all(started.splice(0).map(fake => fake.close()))
  })

  async function start(): Promise<FakeRegistry> {
    const fake = await startRegistry()
    started.push(fake)
    return fake
  }

  /** Publishes the document exactly as `nextIndex` made it, signed by `signer`. */
  const publishDoc = (fake: FakeRegistry, document: string, signer: string = TEST_IDENTITY.index): string => fake.publish('index', 'v1', Buffer.from(document), INDEX_MEDIA_TYPE, signer)
  const client = (fake: FakeRegistry): ReturnType<typeof createRegistry> => createRegistry({ registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier })
  const run = (fake: FakeRegistry, change: Parameters<typeof nextIndex>[0]['change']): ReturnType<typeof nextIndex> => nextIndex({ registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier, change })
  const add = (fake: FakeRegistry, id: string, version: string, body: Buffer = BODY): ReturnType<typeof nextIndex> => run(fake, { action: 'add', id, version, digest: digestOf(body) })

  it('lists a published theme so that the client resolves and installs it', async () => {
    const fake = await start()
    fake.publish('calm', '1.0.0', BODY)
    const next = await add(fake, 'calm', '1.0.0')
    expect(next.base).toBeNull()
    publishDoc(fake, next.document)
    expect(await client(fake).resolve('calm')).toMatchObject({ id: 'calm', version: '1.0.0', digest: DIGEST, tier: 'official', distribution: 'public', code: false })
    expect(digestOf((await client(fake).fetch({ id: 'calm', version: '1.0.0', digest: DIGEST })).data)).toBe(DIGEST)
  })

  it('leaves both versions of two publishes made one after the other, each from the index the first left', async () => {
    const fake = await start()
    const second = packageOf({ 'theme.json': JSON.stringify({ ...THEME, version: '1.1.0' }), 'theme.css': 'b{}' })
    fake.publish('calm', '1.0.0', BODY)
    fake.publish('calm', '1.1.0', second)
    const first = await add(fake, 'calm', '1.0.0')
    publishDoc(fake, first.document)
    const both = await add(fake, 'calm', '1.1.0', second)
    expect(both.base).toBe(first.digest)
    publishDoc(fake, both.document)
    expect(Object.keys(parseIndex(both.document).themes.calm!.versions)).toEqual(['1.0.0', '1.1.0'])
    expect((await client(fake).resolve('calm')).version).toBe('1.1.0')
    expect(await client(fake).newer('calm', '1.0.0')).toEqual(['1.1.0'])
  })

  it('refuses to publish a version that is listed, and the one that was yanked', async () => {
    const fake = await start()
    fake.publish('calm', '1.0.0', BODY)
    publishDoc(fake, (await add(fake, 'calm', '1.0.0')).document)
    expect((await rejection(() => add(fake, 'calm', '1.0.0'))).message).toMatch(/already published/)
    publishDoc(fake, (await run(fake, { action: 'yank', id: 'calm', version: '1.0.0', reason: 'broken', at: AT })).document)
    expect((await rejection(() => add(fake, 'calm', '1.0.0'))).message).toMatch(/already published/)
  })

  it('takes the entry from the package in the registry, not from what the caller says', async () => {
    const fake = await start()
    fake.publish('calm', '1.0.0', BODY)
    expect((await rejection(() => run(fake, { action: 'add', id: 'calm', version: '1.0.0', digest: `sha256:${'0'.repeat(64)}` }))).message).toMatch(/holds sha256:/)
    expect((await rejection(() => add(fake, 'calm', '1.1.0'))).message).toMatch(/not-found|404|manifest/i)
    const code = packageOf({ 'theme.json': JSON.stringify({ ...THEME, version: '1.2.0' }), 'templates/page.vue': '<template><p /></template>' })
    fake.publish('calm', '1.2.0', code)
    const next = await add(fake, 'calm', '1.2.0', code)
    expect(parseIndex(next.document).themes.calm!.versions['1.2.0']).toMatchObject({ code: true, tier: PUBLISH_TIER })
    // The package says it is another version than the tag the caller named
    fake.publish('calm', '9.9.9', BODY)
    expect((await rejection(() => add(fake, 'calm', '9.9.9'))).message).toMatch(/is calm@1\.0\.0, not calm@9\.9\.9/)
  })

  it('refuses a package without an attestation of the publish workflow', async () => {
    const none = await start()
    none.publish('calm', '1.0.0', BODY, undefined, false)
    expect((await rejection(() => add(none, 'calm', '1.0.0'))).message).toMatch(/not-found|404|manifest/i)
    const wrong = await start()
    wrong.publish('calm', '1.0.0', BODY, undefined, TEST_IDENTITY.index)
    expect(((await rejection(() => add(wrong, 'calm', '1.0.0'))) as RegistryError).failure).toBe('attestation')
  })

  it('refuses to build on an index that was not signed by the index identity, and the client refuses such an index too', async () => {
    const fake = await start()
    fake.publish('calm', '1.0.0', BODY)
    const first = await add(fake, 'calm', '1.0.0')
    publishDoc(fake, first.document, TEST_IDENTITY.packages)
    expect(((await rejection(() => add(fake, 'calm', '1.0.0'))) as RegistryError).failure).toBe('attestation')
    const error = await rejection(() => client(fake).resolve('calm'))
    expect((error as RegistryError).failure).toBe('signature')
    expect(error.message).toMatch(/index signature/)
    publishDoc(fake, first.document)
    expect((await client(fake).resolve('calm')).version).toBe('1.0.0')
  })

  it('refuses to write when another index landed while this one was being signed', async () => {
    const fake = await start()
    const second = packageOf({ 'theme.json': JSON.stringify({ ...THEME, version: '1.1.0' }), 'theme.css': 'b{}' })
    fake.publish('calm', '1.0.0', BODY)
    fake.publish('calm', '1.1.0', second)
    // Two requests are prepared from the same (empty) registry; the first one is written
    const one = await add(fake, 'calm', '1.0.0')
    const other = await add(fake, 'calm', '1.1.0', second)
    await expect(assertBase({ registry: fake.registry, base: one.base })).resolves.toBe('write')
    publishDoc(fake, one.document)
    await expect(assertBase({ registry: fake.registry, base: other.base })).rejects.toThrow(/changed while it was being signed/)
    // Prepared again from the index that landed, the second request goes through, and both versions are listed
    const again = await add(fake, 'calm', '1.1.0', second)
    expect(again.base).toBe(one.digest)
    await expect(assertBase({ registry: fake.registry, base: again.base })).resolves.toBe('write')
    publishDoc(fake, again.document)
    expect(Object.keys(parseIndex(again.document).themes.calm!.versions)).toEqual(['1.0.0', '1.1.0'])
    // An index that is gone is not the one that was read either
    await expect(assertBase({ registry: fake.registry, base: `sha256:${'0'.repeat(64)}` })).rejects.toThrow(PublishError)
  })

  it('lets a repeated write finish a half-written index, and refuses any other index', async () => {
    const fake = await start()
    const second = packageOf({ 'theme.json': JSON.stringify({ ...THEME, version: '1.1.0' }), 'theme.css': 'b{}' })
    fake.publish('calm', '1.0.0', BODY)
    fake.publish('calm', '1.1.0', second)
    const one = await add(fake, 'calm', '1.0.0')
    publishDoc(fake, one.document)
    const next = await add(fake, 'calm', '1.1.0', second)
    // The new index landed and its signature did not: index:v1 holds the new document, index:v1.att the old bundle
    fake.publish('index', 'v1', Buffer.from(next.document), INDEX_MEDIA_TYPE, false)
    await expect(assertBase({ registry: fake.registry, base: next.base, digest: next.digest })).resolves.toBe('written')
    // A third index is still refused, and so is the half-written one when the caller does not name it
    await expect(assertBase({ registry: fake.registry, base: next.base, digest: `sha256:${'1'.repeat(64)}` })).rejects.toThrow(/changed while it was being signed/)
    await expect(assertBase({ registry: fake.registry, base: next.base })).rejects.toThrow(/changed while it was being signed/)
    // Once the signature is pushed the registry is whole again
    publishDoc(fake, next.document)
    expect((await client(fake).resolve('calm')).version).toBe('1.1.0')
  })

  it('says which version a cancelled pending request left unlisted, and the re-run lists it', async () => {
    const fake = await start()
    const versions = ['1.0.0', '1.1.0', '1.2.0'].map(version => ({ version, body: packageOf({ 'theme.json': JSON.stringify({ ...THEME, version }), 'theme.css': `v${version}{}` }) }))
    for (const { version, body } of versions) fake.publish('calm', version, body)
    const [first, second, third] = versions as [typeof versions[0], typeof versions[0], typeof versions[0]]
    const listed = (item: typeof first): ReturnType<typeof assertListed> => assertListed({ registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier, id: 'calm', version: item.version, digest: digestOf(item.body), reportDigest: `sha256:${'2'.repeat(64)}` })
    // Three requests reach the group: the first runs, the second is pending and the third cancels it
    publishDoc(fake, (await add(fake, 'calm', first.version, first.body)).document)
    publishDoc(fake, (await add(fake, 'calm', third.version, third.body)).document)
    await expect(listed(first)).resolves.toBeUndefined()
    await expect(listed(third)).resolves.toBeUndefined()
    const lost = await rejection(() => listed(second))
    expect(lost).toBeInstanceOf(PublishError)
    expect(lost.message).toContain(`calm@1.1.0 is pushed and attested but not in the index`)
    expect(lost.message).toContain(`with action add, theme calm, version 1.1.0, digest ${digestOf(second.body)}, report-digest sha256:${'2'.repeat(64)}`)
    // The version the client resolves is still the newest listed one; the lost one is not installable
    expect((await client(fake).resolve('calm')).version).toBe('1.2.0')
    expect(((await rejection(() => client(fake).resolve('calm', '1.1.0'))) as RegistryError).failure).toBe('not-found')
    // The re-run it names prepares the change from the current index and keeps both neighbours
    const again = await add(fake, 'calm', second.version, second.body)
    expect(again.base).not.toBeNull()
    publishDoc(fake, again.document)
    await expect(listed(second)).resolves.toBeUndefined()
    expect(Object.keys(parseIndex(again.document).themes.calm!.versions)).toEqual(['1.0.0', '1.1.0', '1.2.0'])
  })

  it('treats a yanked version as listed, names a theme the index lacks, and refuses another package under the same version', async () => {
    const fake = await start()
    fake.publish('calm', '1.0.0', BODY)
    const base = { registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier, id: 'calm', version: '1.0.0', digest: DIGEST }
    // No index at all: the version is not listed, and the message gives no report digest it was not given
    const none = await rejection(() => assertListed(base))
    expect(none.message).toMatch(/calm@1\.0\.0 is pushed and attested but not in the index/)
    expect(none.message).not.toContain('report-digest')
    publishDoc(fake, (await add(fake, 'calm', '1.0.0')).document)
    const yanked = (await run(fake, { action: 'yank', id: 'calm', version: '1.0.0', reason: 'broken', at: AT })).document
    publishDoc(fake, yanked)
    await expect(assertListed(base)).resolves.toBeUndefined()
    expect((await rejection(() => assertListed({ ...base, id: 'other' }))).message).toMatch(/other@1\.0\.0 is pushed and attested but not in the index/)
    expect((await rejection(() => assertListed({ ...base, digest: `sha256:${'1'.repeat(64)}` }))).message).toMatch(/is listed with the package sha256:.*not the sha256:1+ this run pushed/)
    // An index that the index identity did not sign is not trusted to say the version is listed
    publishDoc(fake, yanked, TEST_IDENTITY.packages)
    expect(((await rejection(() => assertListed(base))) as RegistryError).failure).toBe('attestation')
  })

  it('hides a yanked version from new ranges and keeps it installable for a lock that pins it', async () => {
    const fake = await start()
    const second = packageOf({ 'theme.json': JSON.stringify({ ...THEME, version: '1.1.0' }), 'theme.css': 'b{}' })
    fake.publish('calm', '1.0.0', BODY)
    fake.publish('calm', '1.1.0', second)
    publishDoc(fake, (await add(fake, 'calm', '1.0.0')).document)
    publishDoc(fake, (await add(fake, 'calm', '1.1.0', second)).document)
    const yanked = await run(fake, { action: 'yank', id: 'calm', version: '1.1.0', reason: 'ships a broken font', at: AT })
    publishDoc(fake, yanked.document)
    const pin = { id: 'calm', version: '1.1.0', digest: digestOf(second) }
    expect((await client(fake).resolve('calm')).version).toBe('1.0.0')
    expect(((await rejection(() => client(fake).resolve('calm', '1.1.0'))) as RegistryError).failure).toBe('not-found')
    expect(((await rejection(() => client(fake).fetch(pin))) as RegistryError).failure).toBe('listing')
    expect(digestOf((await client(fake).fetch(pin, { locked: true })).data)).toBe(pin.digest)
  })
})

async function rejection(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run()
  } catch (error) {
    return error as Error
  }
  throw new Error('expected an error')
}

describe('the workflows', () => {
  const root = resolve(__dirname, '..')
  const read = (path: string): string => readFileSync(join(root, path), 'utf8')
  const publish = read('.github/workflows/theme-publish.yml')
  const prepare = read('.github/workflows/theme-index-prepare.yml')
  const listedWorkflow = read('.github/workflows/theme-index-listed.yml')
  const push = read('.github/workflows/theme-push-bundle.yml')
  const templatePublish = read('docs/themes/registry-workflows/publish.yml')
  const templateSign = read('docs/themes/registry-workflows/sign-index.yml')

  it('write the layout the client reads: media types, tags and the report type', () => {
    expect(publish).toContain(`--artifact-type ${REPORT_ARTIFACT_TYPE}`)
    expect(publish).toContain(`:${PACKAGE_MEDIA_TYPE}"`)
    expect(push).toContain(`"\${REGISTRY}/\${THEME}:\${VERSION}${ATTESTATION_TAG_SUFFIX}" "bundle/bundle.json:${BUNDLE_MEDIA_TYPE}"`)
    expect(push).toContain(`/${INDEX_REPOSITORY}:${INDEX_TAG}" "index/index.json:${INDEX_MEDIA_TYPE}"`)
    expect(push).toContain(`/${INDEX_REPOSITORY}:${INDEX_TAG}${ATTESTATION_TAG_SUFFIX}" "bundle/bundle.json:${BUNDLE_MEDIA_TYPE}"`)
    expect(Object.values(ANNOTATIONS).every(key => key.startsWith('io.micelio.theme.'))).toBe(true)
  })

  it('list the core failures of the record in the summary of the publish run, from the gate\'s own output', () => {
    expect(publish).toMatch(/jq -r '\.coreFailures\[\] \|[^\n]*Known failure caused by the core[^\n]*' publish\/gate\.json\n\s*\} >> "\$GITHUB_STEP_SUMMARY"/)
  })

  it('run only for the organisation, install without scripts and keep inputs out of scripts', () => {
    for (const text of [publish, prepare, push, listedWorkflow]) {
      expect(text).toContain('github.repository_owner == \'bogd3v\'')
      expect(text).toContain('npm ci --ignore-scripts')
      expect(text).not.toMatch(/pull_request_target|secrets\./)
      const scripts = [...text.matchAll(/run: \|?\n?([^\n]*(?:\n {10}[^\n]*)*)/g)].map(match => match[1]!)
      expect(scripts.filter(script => script.includes('${{'))).toEqual([])
    }
  })

  it('never sign: the identity of an attestation is the file of micelio-themes whose job makes it', () => {
    for (const text of [publish, prepare, push, listedWorkflow]) expect(text).not.toMatch(/attest-build-provenance|id-token/)
    expect(publish).not.toContain('index:v1')
  })

  it('leave the pinned signer as it is: the templates are the files DEFAULT_SIGNER names, each with one signing job', () => {
    expect(DEFAULT_SIGNER.packages).toBe('https://github.com/bogd3v/micelio-themes/.github/workflows/publish.yml@refs/heads/main')
    expect(DEFAULT_SIGNER.index).toBe('https://github.com/bogd3v/micelio-themes/.github/workflows/sign-index.yml@refs/heads/main')
    for (const [text, file] of [[templatePublish, 'publish.yml'], [templateSign, 'sign-index.yml']] as const) {
      expect(text).toContain(`.github/workflows/${file}@refs/heads/main`)
      expect(text.match(/uses: actions\/attest-build-provenance@/g)).toHaveLength(1)
      expect(text.match(/id-token: write/g)!.length).toBeGreaterThanOrEqual(1)
    }
    // the signing job of each is the one that holds no reusable workflow call
    expect(templatePublish).toMatch(/\n {2}attest:\n[^]*?uses: actions\/attest-build-provenance/)
    expect(templateSign).toMatch(/\n {2}attest:\n[^]*?environment: theme-index[^]*?uses: actions\/attest-build-provenance/)
    expect(templateSign).toMatch(/concurrency:\n\s+group: theme-registry-index\n\s+cancel-in-progress: false/)
  })

  it('name no artifact after a digest: upload-artifact refuses a colon', () => {
    for (const text of [publish, prepare, push, templatePublish, templateSign]) {
      for (const match of text.matchAll(/(?:^|\n)\s*(?:name|bundle-artifact|index-artifact|package-artifact): ([^\n]*)/g)) {
        expect(match[1], match[0]).not.toMatch(/outputs\.digest|inputs\.digest|steps\.\w+\.outputs\.digest|report-digest/)
      }
    }
    // The names the templates build are the ones the artifact steps upload, and what prepare names an artifact after has no prefix
    expect(templateSign).toContain('name: theme-index-bundle-${{ needs.prepare.outputs.index-artifact }}')
    expect(templateSign).toContain('bundle-artifact: theme-index-bundle-${{ needs.prepare.outputs.index-artifact }}')
    expect(prepare).toContain('cut -c8-23')
    expect(publish).toContain('cut -c8-23')
  })

  it('sign and write only in micelio-themes: a called workflow runs in its caller, which may be any repository of the organisation', () => {
    const guard = 'if: github.repository == \'bogd3v/micelio-themes\''
    for (const text of [templatePublish, templateSign]) {
      const signing = text.match(/\n {2}attest:\n[^]*?(?=\n {2}\w[\w-]*:\n|$)/)![0]
      expect(signing, 'the signing job').toContain(guard)
      expect(signing).not.toContain('repository_owner')
    }
    // the write of the index is guarded too
    expect(templateSign).toMatch(/\n {2}write:\n[^]*?if: github\.repository == 'bogd3v\/micelio-themes'/)
  })

  it('send the token only to a registry under ghcr.io/bogd3v, and check the base in tested code', () => {
    for (const text of [publish, push]) {
      const login = text.slice(text.indexOf('Log in to the registry'))
      expect(login.indexOf('ghcr.io/bogd3v/*')).toBeGreaterThan(-1)
      expect(login.indexOf('ghcr.io/bogd3v/*')).toBeLessThan(login.indexOf('oras login'))
    }
    expect(push).toContain('theme:publish -- check-base')
    expect(push).not.toContain('BASE=')
  })

  it('check at the end of a publish that the index lists the version, even when the request to the index was cancelled', () => {
    const job = templatePublish.match(/\n {2}listed:\n[^]*$/)![0]
    expect(job).toMatch(/needs: \[publish, index\]/)
    expect(job).toContain('if: ${{ always() && needs.publish.result == \'success\' }}')
    expect(job).toContain('theme-index-listed.yml@v0.5.4')
    expect(job).not.toMatch(/id-token|attestations: write|packages: write/)
    expect(listedWorkflow).toContain('theme:publish -- listed')
    expect(listedWorkflow).not.toContain('packages: write')
  })

  it('call the core workflows of one release, with the same core-ref', () => {
    for (const text of [templatePublish, templateSign]) {
      const tags = new Set([...text.matchAll(/bogd3v\/micelio\/\.github\/workflows\/[\w-]+\.yml@(v[\d.]+)/g)].map(match => match[1]))
      const refs = new Set([...text.matchAll(/core-ref: (v[\d.]+)/g)].map(match => match[1]))
      expect([...tags]).toHaveLength(1)
      expect(refs).toEqual(tags)
    }
  })
})

describe('checking a bundle before it is pushed', () => {
  const hex = 'a'.repeat(64)
  it('accepts the signer that is pinned for the kind and refuses the other and a different digest', () => {
    const bundle = stubBundle(TEST_IDENTITY.packages, hex)
    expect(() => verifySigned(bundle, 'packages', `sha256:${hex}`, TEST_IDENTITY, stubVerifier)).not.toThrow()
    // a package attested by the workflow file that signs the index, or the other way round
    expect((failureOf(() => verifySigned(stubBundle(TEST_IDENTITY.index, hex), 'packages', `sha256:${hex}`, TEST_IDENTITY, stubVerifier)) as RegistryError).failure).toBe('attestation')
    expect((failureOf(() => verifySigned(bundle, 'index', `sha256:${hex}`, TEST_IDENTITY, stubVerifier)) as RegistryError).failure).toBe('attestation')
    expect((failureOf(() => verifySigned(bundle, 'packages', `sha256:${'b'.repeat(64)}`, TEST_IDENTITY, stubVerifier)) as RegistryError).failure).toBe('attestation')
  })
})
