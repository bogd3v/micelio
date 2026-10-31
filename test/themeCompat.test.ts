import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assembleReport } from '../modules/theme/admission/collect'
import { AdmissionReportSchema } from '../modules/theme/admission/report'
import { checkTheme } from '../modules/theme/check'
import { loadHooks } from '../modules/theme/hooks'
import { addVersion, EMPTY_INDEX, markIncompatible, serializeIndex, successorProblems, yankVersion } from '../modules/theme/publish/index-edit'
import { nextIndex, readSignedIndex } from '../modules/theme/publish/update'
import { createRegistry } from '../modules/theme/registry/client'
import { addTheme } from '../modules/theme/registry/commands'
import type { RegistryContext } from '../modules/theme/registry/commands'
import { INDEX_MEDIA_TYPE } from '../modules/theme/registry/constants'
import { RegistryError } from '../modules/theme/registry/error'
import { parseIndex } from '../modules/theme/registry/registry-index'
import type { IndexVersion, RegistryIndex } from '../modules/theme/registry/types'
import { discoverThemes } from '../modules/theme/themes'
import { planThemes, sourceOf } from '../scripts/theme-compat/plan'
import { decide, markReason, resultsTable } from '../scripts/theme-compat/results'
import { digestOf, startRegistry, stubVerifier, TEST_IDENTITY } from './fixtures/registry'
import type { FakeRegistry } from './fixtures/registry'
import { packageOf } from './fixtures/tar'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const AT = new Date('2026-10-30T12:00:00Z')
const SHA = 'a'.repeat(40)
const started: FakeRegistry[] = []
const dirs: string[] = []

afterEach(async () => {
  await Promise.all(started.splice(0).map(fake => fake.close()))
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'micelio-compat-'))
  dirs.push(dir)
  return dir
}

function theme(id: string, version: string): Buffer {
  return packageOf({ 'theme.json': JSON.stringify({ id, name: id, version, contract: 2, license: 'MIT' }), 'theme.css': `.${id}{}` })
}

function entry(digest: string, fields: Partial<IndexVersion> = {}): IndexVersion {
  return { digest, contract: '2.0', license: 'MIT', tier: 'official', distribution: 'public', status: 'published', code: false, ...fields }
}

describe('marking a version incompatible in the index', () => {
  const one = addVersion(EMPTY_INDEX, 'calm', '1.0.0', entry(digestOf(theme('calm', '1.0.0'))))

  it('marks a published version from a core version, with the reason and the time, and only that', () => {
    const marked = markIncompatible(one, 'calm', '1.0.0', '0.6.0', 'fails admission', AT)
    expect(marked.themes.calm!.versions['1.0.0']).toMatchObject({ status: 'incompatible', incompatible: { core: '0.6.0', reason: 'fails admission', at: '2026-10-30T12:00:00.000Z' } })
    expect(() => markIncompatible(marked, 'calm', '1.0.0', '0.7.0', 'again', AT)).toThrow('is incompatible, not published')
    expect(() => markIncompatible(yankVersion(one, 'calm', '1.0.0', 'bad', AT), 'calm', '1.0.0', '0.6.0', 'x', AT)).toThrow('is yanked, not published')
    expect(() => markIncompatible(one, 'calm', '2.0.0', '0.6.0', 'x', AT)).toThrow('is not in the index')
    expect(() => markIncompatible(one, 'calm', '1.0.0', 'latest', 'x', AT)).toThrow('is not a core version')
    expect(() => markIncompatible(one, 'calm', '1.0.0', '0.6.0', ' ', AT)).toThrow('needs a reason')
    expect(() => markIncompatible(one, 'calm', '1.0.0', '0.6.0', 'two\nlines', AT)).toThrow('needs a reason')
  })

  it('accepts the mark as a successor, and nothing else done to a published version', () => {
    const marked = markIncompatible(one, 'calm', '1.0.0', '0.6.0', 'fails admission', AT)
    expect(successorProblems(one, marked)).toEqual([])
    const changed = { ...marked, themes: { calm: { versions: { '1.0.0': { ...marked.themes.calm!.versions['1.0.0']!, code: true } } } } }
    expect(successorProblems(one, changed)).toEqual(['calm@1.0.0 was changed'])
    const bare = { ...one, themes: { calm: { versions: { '1.0.0': { ...one.themes.calm!.versions['1.0.0']!, status: 'incompatible' as const } } } } }
    expect(successorProblems(one, bare)).toEqual(['calm@1.0.0 was changed'])
    expect(successorProblems(marked, one)).toEqual(['calm@1.0.0 was changed'])
    expect(successorProblems(marked, markIncompatible(one, 'calm', '1.0.0', '0.7.0', 'other', AT))).toEqual(['calm@1.0.0 was changed'])
    const both = { ...marked, themes: { calm: { versions: { '1.0.0': { ...marked.themes.calm!.versions['1.0.0']!, yank: { reason: 'x', at: AT.toISOString() } } } } } }
    expect(successorProblems(one, both)).toEqual(['calm@1.0.0 was changed'])
  })

  it('writes the mark in a form the client reads, and refuses a core that is not a version', () => {
    const text = serializeIndex(markIncompatible(one, 'calm', '1.0.0', '0.6.0', 'fails admission', AT))
    expect(parseIndex(text).themes.calm!.versions['1.0.0']!.incompatible).toEqual({ core: '0.6.0', reason: 'fails admission', at: '2026-10-30T12:00:00.000Z' })
    const broken = JSON.stringify({ version: 1, themes: { calm: { versions: { '1.0.0': { ...entry(digestOf(theme('calm', '1.0.0'))), status: 'incompatible', incompatible: { core: 'latest', reason: 'x', at: AT.toISOString() } } } } } })
    expect(() => parseIndex(broken)).toThrow('the index is not valid: themes.calm.versions.1.0.0.incompatible.core')
  })
})

describe('theme:add on a core a version is marked incompatible from', () => {
  async function registry(fields: Partial<IndexVersion> = {}): Promise<{ fake: FakeRegistry, index: RegistryIndex }> {
    const fake = await startRegistry()
    started.push(fake)
    const old = fake.publish('sample', '1.0.0', theme('sample', '1.0.0'))
    const latest = fake.publish('sample', '1.1.0', theme('sample', '1.1.0'))
    const index: RegistryIndex = { version: 1, themes: { sample: { versions: { '1.0.0': entry(old), '1.1.0': entry(latest, { status: 'incompatible', incompatible: { core: '0.6.0', reason: 'myc-btn was renamed', at: AT.toISOString() }, ...fields }) } } } }
    fake.publishIndex(index)
    return { fake, index }
  }

  function context(fake: FakeRegistry, core: string | undefined, log: string[]): RegistryContext {
    return { root: temp(), registry: fake.registry, registryFor: registryName => createRegistry({ registry: registryName, identity: TEST_IDENTITY, verifier: stubVerifier, ...(core ? { core } : {}) }), cacheDir: temp(), log: line => log.push(line) }
  }

  it('skips it from that core on, installs the version before it and says why', async () => {
    const { fake } = await registry()
    const lines: string[] = []
    expect((await addTheme(context(fake, '0.6.0', lines), 'sample')).entry.version).toBe('1.0.0')
    expect(lines).toContain('skipped sample@1.1.0 is marked incompatible with micelio 0.6.0 and later: myc-btn was renamed')
  })

  it('still installs it on an older core, with nothing skipped', async () => {
    const { fake } = await registry()
    const lines: string[] = []
    expect((await addTheme(context(fake, '0.5.5', lines), 'sample')).entry.version).toBe('1.1.0')
    expect(lines.some(line => line.startsWith('skipped'))).toBe(false)
  })

  it('names the version and the core when nothing else satisfies the range', async () => {
    const { fake } = await registry()
    let error: unknown
    try {
      await addTheme(context(fake, '0.6.1', []), 'sample@1.1')
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(RegistryError)
    expect((error as RegistryError).failure).toBe('not-found')
    expect((error as RegistryError).message).toContain('1.1.0 is marked incompatible with micelio 0.6.0 and later: myc-btn was renamed')
  })

  it('skips a version marked incompatible with no core, and any when the core is unknown', async () => {
    const { fake } = await registry({ incompatible: undefined })
    expect((await addTheme(context(fake, '0.1.0', []), 'sample')).entry.version).toBe('1.0.0')
    const { fake: other } = await registry()
    expect((await addTheme(context(other, undefined, []), 'sample')).entry.version).toBe('1.0.0')
  })

  it('does not offer it as newer, installs it on an older core and keeps a lock that pins it', async () => {
    const { fake, index } = await registry()
    const pin = { id: 'sample', version: '1.1.0', digest: index.themes.sample!.versions['1.1.0']!.digest }
    const options = { registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier }
    expect(await createRegistry({ ...options, core: '0.6.0' }).newer('sample', '1.0.0')).toEqual([])
    expect(await createRegistry({ ...options, core: '0.5.5' }).newer('sample', '1.0.0')).toEqual(['1.1.0'])
    expect((await createRegistry({ ...options, core: '0.5.5' }).fetch(pin)).data).toBeInstanceOf(Buffer)
    await expect(createRegistry({ ...options, core: '0.6.0' }).fetch(pin)).rejects.toThrow('the index marks this version incompatible')
    expect((await createRegistry({ ...options, core: '0.6.0' }).fetch(pin, { locked: true })).data).toBeInstanceOf(Buffer)
  })
})

describe('marking through the signed publish path', () => {
  it('lists, marks, and the client then skips the version from that core', async () => {
    const fake = await startRegistry()
    started.push(fake)
    const body = theme('calm', '1.0.0')
    fake.publish('calm', '1.0.0', body)
    const run = (change: Parameters<typeof nextIndex>[0]['change']): ReturnType<typeof nextIndex> => nextIndex({ registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier, change })
    fake.publish('index', 'v1', Buffer.from((await run({ action: 'add', id: 'calm', version: '1.0.0', digest: digestOf(body) })).document), INDEX_MEDIA_TYPE, TEST_IDENTITY.index)
    const next = await run({ action: 'incompatible', id: 'calm', version: '1.0.0', core: '0.6.0', reason: 'fails admission on micelio 0.6.0', at: AT })
    fake.publish('index', 'v1', Buffer.from(next.document), INDEX_MEDIA_TYPE, TEST_IDENTITY.index)
    const index = await readSignedIndex({ registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier })
    expect(index.themes.calm!.versions['1.0.0']!.status).toBe('incompatible')
    const options = { registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier }
    await expect(createRegistry({ ...options, core: '0.6.0' }).resolve('calm')).rejects.toThrow('1.0.0 is marked incompatible with micelio 0.6.0 and later: fails admission on micelio 0.6.0')
    expect((await createRegistry({ ...options, core: '0.5.5' }).resolve('calm')).version).toBe('1.0.0')
    await expect(run({ action: 'incompatible', id: 'calm', version: '1.0.0', core: '0.7.0', reason: 'again', at: AT })).rejects.toThrow('is incompatible, not published')
  })

  it('refuses to read an index nobody signed', async () => {
    const fake = await startRegistry()
    started.push(fake)
    await expect(readSignedIndex({ registry: fake.registry, identity: TEST_IDENTITY, verifier: stubVerifier })).rejects.toThrow('there is nothing to check')
  })
})

describe('which versions are checked', () => {
  const index: RegistryIndex = {
    version: 1,
    themes: {
      bogota: { versions: { '1.0.0': entry('sha256:' + '1'.repeat(64)), '1.0.1': entry('sha256:' + '2'.repeat(64)), '1.1.0': entry('sha256:' + '3'.repeat(64), { status: 'yanked' }) } },
      calm: { versions: { '0.2.0': entry('sha256:' + '4'.repeat(64), { tier: 'community' }), '0.10.0': entry('sha256:' + '5'.repeat(64), { tier: 'community', status: 'incompatible' }) } },
      gone: { versions: { '1.0.0': entry('sha256:' + '6'.repeat(64), { status: 'yanked' }) } },
      paid: { versions: { '1.0.0': entry('sha256:' + '7'.repeat(64), { distribution: 'licensed' }) } },
    },
  }

  it('takes the latest non-yanked public version of each theme, by semver', () => {
    expect(planThemes(index)).toEqual([
      { id: 'bogota', version: '1.0.1', tier: 'official', digest: 'sha256:' + '2'.repeat(64), status: 'published' },
      { id: 'calm', version: '0.10.0', tier: 'community', digest: 'sha256:' + '5'.repeat(64), status: 'incompatible' },
    ])
  })
})

describe('where a published version was built from', () => {
  const COMMIT = 'c'.repeat(40)
  /** A bundle as `actions/attest-build-provenance` writes it, from the part the check reads: the SLSA v1 provenance in the DSSE envelope. */
  function bundleOf(dependencies: unknown[]): Buffer {
    const statement = { _type: 'https://in-toto.io/Statement/v1', predicateType: 'https://slsa.dev/provenance/v1', predicate: { buildDefinition: { resolvedDependencies: dependencies } } }
    return Buffer.from(JSON.stringify({ dsseEnvelope: { payloadType: 'application/vnd.in-toto+json', payload: Buffer.from(JSON.stringify(statement)).toString('base64') } }))
  }
  const dependency = (uri: string, gitCommit: unknown = COMMIT): unknown => ({ uri, digest: { gitCommit } })

  it('is the commit the signed provenance names in the themes repository', () => {
    expect(sourceOf(bundleOf([dependency('git+https://github.com/bogd3v/micelio-themes@refs/heads/main')]), 'bogd3v/micelio-themes')).toEqual({ repository: 'bogd3v/micelio-themes', commit: COMMIT })
  })

  it('is no source when the provenance names another repository, no commit, a short one or cannot be read', () => {
    const expected = 'bogd3v/micelio-themes'
    expect(sourceOf(bundleOf([dependency('git+https://github.com/someone/else@refs/heads/main')]), expected)).toEqual({ reason: 'its provenance names someone/else, not bogd3v/micelio-themes' })
    expect(sourceOf(bundleOf([]), expected)).toEqual({ reason: 'its provenance names no source commit' })
    expect(sourceOf(bundleOf([dependency('git+https://github.com/bogd3v/micelio-themes@refs/heads/main', 'main')]), expected)).toEqual({ reason: 'its provenance names a commit that is not a full SHA' })
    expect(sourceOf(bundleOf([{ uri: 'https://example.test/x' }]), expected)).toEqual({ reason: 'its provenance names no source commit' })
    expect(sourceOf(Buffer.from('not json'), expected)).toEqual({ reason: 'its provenance cannot be read' })
  })
})

describe('a breaking change of the core', () => {
  // The admission report of a theme made the way `theme:admit static` and `report` make it, from the real contract validator
  function reportFor(id: string, hooks: ReturnType<typeof loadHooks>): ReturnType<typeof assembleReport> {
    const installed = discoverThemes([join(ROOT, 'themes')]).find(item => item.id === id)!
    const checked = checkTheme(installed, hooks)
    return AdmissionReportSchema.parse(assembleReport({
      themeId: id,
      staticResult: { theme: { id, version: '1.0.0', contract: '2.0', code: false }, errors: checked.errors, warnings: [], package: { file: `${id}-1.0.0.tgz`, digest: 'sha256:' + 'a'.repeat(64), bytes: 1 } },
      performance: [],
      quality: undefined,
      qualityExpected: false,
      visual: false,
      builds: [],
      core: { repository: 'bogd3v/micelio', ref: SHA, sha: SHA, version: '0.6.0', contract: '2.0' },
      run: 'https://github.com/bogd3v/micelio-themes/actions/runs/1',
      now: AT,
    }))
  }

  /** The public hooks with one class renamed, as a core release that renames `myc-btn` would ship them. */
  function renamed(): { hooks: ReturnType<typeof loadHooks>, was: string } {
    const hooks = loadHooks(join(ROOT, 'app'))
    const css = readFileSync(join(ROOT, 'themes/starter/theme.css'), 'utf8')
    const was = [...hooks.classes].find(name => css.includes(`.${name}`))!
    return { hooks: { classes: new Set([...hooks.classes].filter(name => name !== was).concat(`${was}-renamed`)), attributes: hooks.attributes }, was }
  }

  const entryOf = (tier: 'official' | 'community', status: 'published' | 'incompatible' = 'published'): Parameters<typeof decide>[0][number] => ({ id: 'starter', version: '1.0.0', tier, digest: 'sha256:' + 'a'.repeat(64), status })

  it('passes while the hook exists and fails the admission when it is renamed', () => {
    const { hooks, was } = renamed()
    expect(reportFor('starter', loadHooks(join(ROOT, 'app'))).ok).toBe(true)
    const failed = reportFor('starter', hooks)
    expect(failed.ok).toBe(false)
    expect(failed.errors.some(error => error.message.includes(was))).toBe(true)
  })

  it('blocks the release when the theme is official', () => {
    const { hooks, was } = renamed()
    const decision = decide([entryOf('official')], [], new Map([['starter', reportFor('starter', hooks)]]))
    expect(decision.blocking.map(item => item.id)).toEqual(['starter'])
    expect(decision.incompatible).toEqual([])
    expect(decision.results[0]!.reason).toContain(was)
  })

  it('never blocks the release for a community theme: it is marked incompatible from this core', () => {
    const { hooks } = renamed()
    const decision = decide([entryOf('community')], [], new Map([['starter', reportFor('starter', hooks)]]))
    expect(decision.blocking).toEqual([])
    expect(decision.incompatible.map(item => item.id)).toEqual(['starter'])
    expect(markReason(decision.incompatible[0]!, '0.6.0')).toMatch(/^fails admission on micelio 0\.6\.0: static: /)
  })

  it('does not mark a version twice, and does not mark one that passes', () => {
    const { hooks } = renamed()
    expect(decide([entryOf('community', 'incompatible')], [], new Map([['starter', reportFor('starter', hooks)]])).incompatible).toEqual([])
    const ok = decide([entryOf('community')], [], new Map([['starter', reportFor('starter', loadHooks(join(ROOT, 'app')))]]))
    expect(ok.results[0]!.outcome).toBe('pass')
    expect([ok.blocking, ok.incompatible]).toEqual([[], []])
  })

  it('counts a missing report, a report of another version and an unchecked official theme as failures', () => {
    expect(decide([entryOf('official')], [], new Map()).blocking[0]!.reason).toContain('the admission did not finish')
    const wrong = { ...reportFor('starter', loadHooks(join(ROOT, 'app'))) }
    wrong.theme = { ...wrong.theme, version: '0.9.0' }
    expect(decide([entryOf('official')], [], new Map([['starter', wrong]])).blocking[0]!.reason).toBe('the report is for 0.9.0, not 1.0.0')
    const unchecked = decide([], [{ ...entryOf('official'), reason: 'its sources are not in the repository that called the check' }], new Map())
    expect(unchecked.blocking.map(item => item.outcome)).toEqual(['unchecked'])
    expect(decide([], [{ ...entryOf('community'), reason: 'x' }], new Map()).incompatible).toEqual([])
  })

  it('runs as a command: results.json, the table and an error line per blocking official theme, from the reports on disk', () => {
    const { hooks } = renamed()
    const dir = temp()
    const planned = { core: { version: '0.6.0' }, checked: [entryOf('official'), { ...entryOf('community'), id: 'calm' }], unchecked: [] }
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(planned))
    for (const id of ['starter', 'calm']) {
      mkdirSync(join(dir, 'reports', id), { recursive: true })
      writeFileSync(join(dir, 'reports', id, 'admission-report.json'), JSON.stringify({ ...reportFor('starter', hooks), theme: { id, version: '1.0.0', contract: '2.0', code: false } }))
    }
    const done = spawnSync('npx', ['jiti', 'scripts/theme-compat.ts', 'decide', '--plan', join(dir, 'plan.json'), '--reports', join(dir, 'reports'), '--out', join(dir, 'results.json'), '--summary', join(dir, 'results.md'), '--marks'], { cwd: ROOT, encoding: 'utf8' })
    expect(done.status).toBe(0)
    expect(done.stdout).toMatch(/::error::starter@1\.0\.0 \(official\) fails on this core: static: /)
    const results = JSON.parse(readFileSync(join(dir, 'results.json'), 'utf8')) as { blocked: boolean, blocking: Array<{ theme: string }>, incompatible: Array<{ theme: string, core: string, reason: string }> }
    expect(results.blocked).toBe(true)
    expect(results.blocking.map(item => item.theme)).toEqual(['starter'])
    expect(results.incompatible).toEqual([expect.objectContaining({ theme: 'calm', core: '0.6.0', reason: expect.stringMatching(/^fails admission on micelio 0\.6\.0: static: /) as string })])
    expect(readFileSync(join(dir, 'results.md'), 'utf8')).toContain('| calm | 1.0.0 | community | fail (incompatible from this core)')
  })

  it('does not block on a community theme whose admission job failed before it wrote a report', () => {
    const decision = decide([entryOf('community')], [], new Map())
    expect(decision.blocking).toEqual([])
    expect(decision.results[0]).toMatchObject({ outcome: 'fail', reason: expect.stringContaining('the admission did not finish') as string })
  })

  it('proposes no mark on a released core: results.json lists none and the table says the failure is not marked', () => {
    const { hooks } = renamed()
    const dir = temp()
    writeFileSync(join(dir, 'plan.json'), JSON.stringify({ core: { version: '0.5.5' }, checked: [entryOf('community')], unchecked: [] }))
    mkdirSync(join(dir, 'reports', 'starter'), { recursive: true })
    writeFileSync(join(dir, 'reports', 'starter', 'admission-report.json'), JSON.stringify(reportFor('starter', hooks)))
    const done = spawnSync('npx', ['jiti', 'scripts/theme-compat.ts', 'decide', '--plan', join(dir, 'plan.json'), '--reports', join(dir, 'reports'), '--out', join(dir, 'results.json'), '--summary', join(dir, 'results.md')], { cwd: ROOT, encoding: 'utf8' })
    expect(done.status).toBe(0)
    const results = JSON.parse(readFileSync(join(dir, 'results.json'), 'utf8')) as { blocked: boolean, incompatible: unknown[] }
    expect(results).toMatchObject({ blocked: false, incompatible: [] })
    expect(readFileSync(join(dir, 'results.md'), 'utf8')).toContain('fail (fails; not marked, the core is released)')
  })

  it('keeps a hostile reason inside its table cell: a backslash before a pipe, a pipe and a newline', () => {
    const reason = 'x \\| a|b\n| injected | cell |\ny\\'
    const table = resultsTable(decide([], [{ ...entryOf('community'), reason }], new Map()), '0.6.0')
    const lines = table.split('\n')
    const row = lines.find(line => line.startsWith('| starter |'))!
    expect(lines).toHaveLength(5)
    expect(row.replace(/\\\\|\\\|/g, '').split('|')).toHaveLength(7)
    expect(row).toContain('x \\\\\\| a\\|b \\| injected \\| cell \\| y\\\\')
  })

  it('writes the reason of a failed admission on one line, so it cannot start a workflow command', () => {
    const { hooks } = renamed()
    const bad = reportFor('starter', hooks)
    bad.ok = false
    bad.errors = [{ check: 'static', kind: 'contract', message: 'one\n::set-output name=x::y' }] as typeof bad.errors
    const reason = decide([entryOf('official')], [], new Map([['starter', bad]])).blocking[0]!.reason
    expect(reason).toBe('static: one ::set-output name=x::y')
  })

  it('renders the link of a report only for a GitHub Actions run, and shows a version that is not semver as a placeholder', () => {
    const { hooks } = renamed()
    const hostile = ['https://a.example/x\n::warning::pwn', 'https://github.com/o/r/actions/runs/1\n::warning::pwn', 'https://github.com/o/r/actions/runs/1)|x', 'https://evil.example/o/r/actions/runs/1']
    for (const run of hostile) {
      const bad = { ...reportFor('starter', hooks), run }
      expect(decide([entryOf('community')], [], new Map([['starter', bad]])).results[0]!.report).toBeNull()
    }
    expect(decide([entryOf('community')], [], new Map([['starter', reportFor('starter', hooks)]])).results[0]!.report).toBe('https://github.com/bogd3v/micelio-themes/actions/runs/1')
    const odd = reportFor('starter', hooks)
    odd.theme = { ...odd.theme, version: '1.0.0\n::set-output name=x::y' }
    const reason = decide([entryOf('official')], [], new Map([['starter', odd]])).blocking[0]!.reason
    expect(reason).toBe('the report is for an invalid version, not 1.0.0')
  })

  it('shows report text as a code span, so a link, an image or HTML in it is not rendered', () => {
    const reason = 'see [get it](https://evil.example) ![x](https://evil.example/i.png) <img src=x> `code` \u001b[31m\u202eend'
    const table = resultsTable(decide([], [{ ...entryOf('community'), reason }], new Map()), '0.6.0')
    const row = table.split('\n').find(line => line.startsWith('| starter |'))!
    expect(row).toContain(': `see [get it](https://evil.example) ![x](https://evil.example/i.png) <img src=x> \'code\' [31m end` |')
    expect(row.match(/`/g)).toHaveLength(2)
    expect(row.includes('\u001b') || row.includes('\u202e')).toBe(false)
  })

  it('keeps a backtick and a control character out of the reason written to the index and the marks', () => {
    const result = { ...entryOf('community'), outcome: 'fail' as const, reason: 'x`, version `9.9.9`, reason `ok\u001b[2J', report: null }
    const text = markReason(result, '0.6.0')
    expect(text.includes('`') || text.includes('\u001b')).toBe(false)
    expect(text).toBe('fails admission on micelio 0.6.0: x\', version \'9.9.9\', reason \'ok [2J')
  })

  it('writes the ::error:: line of an unchecked official theme on one line, so its reason cannot start a workflow command', () => {
    const dir = temp()
    const reason = 'its provenance names a/b\n::warning::x, not o/r'
    writeFileSync(join(dir, 'plan.json'), JSON.stringify({ core: { version: '0.6.0' }, checked: [], unchecked: [{ ...entryOf('official'), reason }] }))
    mkdirSync(join(dir, 'reports'), { recursive: true })
    const done = spawnSync('npx', ['jiti', 'scripts/theme-compat.ts', 'decide', '--plan', join(dir, 'plan.json'), '--reports', join(dir, 'reports'), '--out', join(dir, 'results.json'), '--summary', join(dir, 'results.md')], { cwd: ROOT, encoding: 'utf8' })
    expect(done.status).toBe(0)
    expect(done.stdout).toContain('::error::starter@1.0.0 (official) was not checked: its provenance names a/b ::warning::x, not o/r')
    expect(done.stdout.split('\n').filter(line => line.startsWith('::'))).toEqual([expect.stringMatching(/^::error::starter@1\.0\.0 /) as string])
  })

  it('writes the table of the release notes: theme, version, tier, result and the link to the report', () => {
    const { hooks } = renamed()
    const table = resultsTable(decide([entryOf('community')], [], new Map([['starter', reportFor('starter', hooks)]])), '0.6.0')
    expect(table.split('\n').slice(0, 4)).toEqual(['### Published themes on micelio 0.6.0', '', '| Theme | Version | Tier | Result | Report |', '| --- | --- | --- | --- | --- |'])
    expect(table).toMatch(/\| starter \| 1\.0\.0 \| community \| fail \(incompatible from this core\): `static: .*` \| \[report\]\(https:\/\/github\.com\/bogd3v\/micelio-themes\/actions\/runs\/1\) \|/)
    expect(resultsTable(decide([], [], new Map()), '0.6.0')).toContain('_none published_')
  })
})

describe('the workflows', () => {
  const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8')
  const compat = read('.github/workflows/theme-compat.yml')
  const runs = read('.github/workflows/theme-compat-runs.yml')
  const release = read('.github/workflows/release.yml')
  const admission = read('.github/workflows/theme-admission.yml')
  const sign = read('docs/themes/registry-workflows/sign-index.yml')

  it('give theme-admission.yml an optional source for the themes that leaves every other caller as it was', () => {
    for (const name of ['theme-source-repository', 'theme-source-ref']) expect(admission).toMatch(new RegExp(`${name}:\\n {8}description: [^\\n]*\\n {8}type: string\\n {8}default: ''\\n`))
    // The three checkouts of the themes name the caller's repository and the default ref when the inputs are empty, which is what `actions/checkout` did with neither
    const checkouts = [...admission.matchAll(/name: Checkout the themes\n {8}if: [^\n]*\n {8}uses: [^\n]*\n {8}with:\n((?: {10}[^\n]*\n)+)/g)].map(match => match[1])
    expect(checkouts).toHaveLength(3)
    for (const block of checkouts) {
      expect(block).toBe('          repository: ${{ inputs.theme-source-repository || github.repository }}\n          ref: ${{ inputs.theme-source-ref }}\n          path: theme-source\n          persist-credentials: false\n')
    }
    // `external` stays what it was unless a source is named
    expect(admission).toContain('[ "${CALLER}" = "${CORE_REPOSITORY}" ] && [ -z "${SOURCE_REPOSITORY}" ] && echo false || echo true')
  })

  it('call theme-admission.yml once per theme with the commit of its published version, a read-only token and no secret', () => {
    expect(compat).toMatch(/uses: \.\/\.github\/workflows\/theme-admission\.yml\n/)
    expect(compat).toContain('theme-source-repository: ${{ inputs.source-repository }}')
    expect(compat).toContain('theme-source-ref: ${{ matrix.commit }}')
    expect(compat).toContain('theme-dirs: ${{ matrix.id }}')
    expect(compat).toContain('fail-on-errors: false')
    for (const text of [compat, runs]) {
      expect(text).not.toMatch(/secrets\.|pull_request_target|id-token|attest-build-provenance|packages: write|contents: write/)
      const scripts = [...text.matchAll(/run: \|?\n?([^\n]*(?:\n {10}[^\n]*)*)/g)].map(match => match[1]!)
      expect(scripts.filter(script => script.includes('${{'))).toEqual([])
    }
    expect(compat).toContain('npm ci --ignore-scripts')
  })

  it('fail the run on an official theme only, unless the caller reads the result itself', () => {
    expect(compat).toMatch(/if: inputs\.fail-on-blocked && steps\.decide\.outputs\.blocked == 'true'/)
    expect(compat).toMatch(/fail-on-blocked:\n {8}description: [^\n]*\n {8}type: boolean\n {8}default: true/)
  })

  it('run in the release before it tags, and block it on an official theme (a warning in a dry run)', () => {
    const check = release.indexOf('name: Check the release can be published')
    const tag = release.indexOf('name: Tag the images')
    expect(release).toMatch(/compat:\n {4}name: Theme compatibility\n {4}needs: version\n {4}if: github\.ref == 'refs\/heads\/main'\n {4}uses: \.\/\.github\/workflows\/theme-compat\.yml\n {4}with:\n {6}core-ref: \$\{\{ github\.sha \}\}\n {6}fail-on-blocked: false/)
    expect(release).toMatch(/release:\n {4}name: Release\n {4}needs: compat/)
    expect(release).toContain('COMPAT_BLOCKED: ${{ needs.compat.outputs.blocked }}')
    // The gate reads the decision, never the conclusion of the call: a community theme whose admission job fails turns the call red
    expect(release).toContain('COMPAT_DECIDED: ${{ needs.compat.outputs.decided }}')
    expect(release).toContain('[ "$COMPAT_DECIDED" != true ]')
    expect(release).toContain('needs.compat.outputs.decided == \'true\'')
    expect(release.replace(/if: github\.ref == 'refs\/heads\/main' && !cancelled\(\) && needs\.compat\.result != 'skipped'/, '')).not.toContain('needs.compat.result')
    expect(compat).toContain('decided: ${{ steps.decide.outputs.decided }}')
    expect(compat).toContain('echo "decided=true"')
    const gate = release.indexOf('elif [ "$COMPAT_BLOCKED" != false ]; then')
    expect(gate).toBeGreaterThan(check)
    expect(gate).toBeLessThan(tag)
    expect(release).toContain('if [ "$failed" = 1 ] && [ "$DRY_RUN" != true ]; then exit 1; fi')
    expect(release.indexOf('## Theme compatibility')).toBeLessThan(tag)
    expect(release).not.toMatch(/THEMES_REPO|compat-runs|micelio-themes/)
  })

  it('propose marks only when publishing a release, never in a dry run', () => {
    expect(compat).toMatch(/propose-marks:\n {8}description: [^\n]*\n {8}type: boolean\n {8}default: false/)
    expect(compat).toContain('if [ "$PROPOSE_MARKS" = true ]; then marks+=(--marks); fi')
    expect(release).toContain('propose-marks: ${{ !inputs.dry_run && needs.version.outputs.matches == \'true\' }}')
    expect(release).not.toContain('propose-marks: true')
    expect(runs).not.toContain('propose-marks')
  })

  it('propose no mark in a publishing run whose package.json is not the version being released: the compat job needs the version job', () => {
    expect(release).toMatch(/\n {2}compat:\n {4}name: Theme compatibility\n {4}needs: version\n/)
    expect(release.indexOf('\n  version:\n')).toBeLessThan(release.indexOf('\n  compat:\n'))
    const script = /name: Compare package\.json with the version to release\n(?: {8}[^\n]*\n)*? {8}run: \|\n((?: {10}[^\n]*\n)+)/.exec(release)?.[1]
    expect(script).toBeDefined()
    // The step itself, with the version script replaced by a fixture: a package.json that still holds the released version never matches
    const outcome = (packageVersion: string, releasing: string, candidate: boolean): string => {
      const dir = temp()
      mkdirSync(join(dir, 'scripts', 'release'), { recursive: true })
      writeFileSync(join(dir, 'scripts', 'release', 'version.mjs'), `console.log(JSON.stringify({ version: '${releasing}' }))\n`)
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: packageVersion }))
      const output = join(dir, 'github-output')
      writeFileSync(output, '')
      const done = spawnSync('bash', ['-e', '-c', script!], { cwd: dir, encoding: 'utf8', env: { ...process.env, RC: String(candidate), GITHUB_OUTPUT: output } })
      expect(done.status, done.stderr).toBe(0)
      return readFileSync(output, 'utf8').trim()
    }
    expect(outcome('0.5.5', '0.6.0', false)).toBe('matches=false')
    expect(outcome('0.6.0', '0.6.0', false)).toBe('matches=true')
    expect(outcome('0.6.0', '0.6.0-rc.1', true)).toBe('matches=true')
    expect(outcome('0.5.5', '0.6.0-rc.1', true)).toBe('matches=false')
  })

  it('run every week and for a pull request labeled contract of this repository', () => {
    expect(runs).toContain('cron: \'17 5 * * 1\'')
    expect(runs).toContain('contains(github.event.pull_request.labels.*.name, \'contract\')')
    expect(runs).toContain('github.event.pull_request.head.repo.full_name == github.repository')
    expect(runs).toContain('types: [opened, synchronize, reopened, labeled]')
    expect(runs).toContain('(github.event.action != \'labeled\' || github.event.label.name == \'contract\')')
    expect(runs).toContain('core-ref: ${{ github.event.pull_request.head.sha || github.sha }}')
  })

  it('mark through the signed path of a yank: Sign index with the action incompatible', () => {
    expect(sign).toContain('options: [yank, incompatible, add]')
    expect(read('.github/workflows/theme-index-prepare.yml')).toContain('"${ACTION}" == incompatible')
    expect(compat).toContain('run **Sign index** in bogd3v/micelio-themes with action `incompatible`')
  })
})
