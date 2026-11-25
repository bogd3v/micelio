import { afterEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { previewDraftPath, previewDraftTarget } from '../app/helpers/preview'
import { installTheme } from '../modules/theme/install/install'
import type { ThemePin } from '../modules/theme/registry/types'
import { themeDataOf } from '../server/lib/themeData'
import { THEME_HEADER, THEME_PREVIEW_HEADER } from '../server/lib/themeSwitch/request'
import type { PreviewedTheme } from '../server/lib/themeSwitch/types'
import { pinRequestToPreviewTheme, previewedTheme } from '../server/utils/previewTheme'
import { startRegistry } from './fixtures/registry'
import type { FakeRegistry } from './fixtures/registry'
import { cleanup, installFor, packaged, publishAll, rig, ROOT } from './fixtures/themeSwitch'
import type { Rig } from './fixtures/themeSwitch'

// The theme override of a preview grant (ADR 0019, amendment of 2026-11-25): `ThemeSwitch.preview` finds an installed theme by id and version,
// for one draft response, and never activates, installs or evicts one.

const registries: FakeRegistry[] = []

async function registry(): Promise<FakeRegistry> {
  const fake = await startRegistry()
  registries.push(fake)
  return fake
}

afterEach(async () => {
  await Promise.all(registries.splice(0).map(fake => fake.close()))
  cleanup()
  vi.unstubAllGlobals()
})

/** A packed theme with the starter's slots: a code theme. */
function withSlots(id: string, version: string): { data: Buffer, pin: ThemePin } {
  return packaged(id, (dir) => {
    cpSync(join(ROOT, 'themes/starter/slots'), join(dir, 'slots'), { recursive: true })
  }, version)
}

/** Installs a package into the rig's deployment store with its attestation, as a host that installs centrally into a shared store does: code allowed. */
async function installCentrally(r: Rig, fake: FakeRegistry, pin: ThemePin): Promise<void> {
  const install = installFor(fake, r.deployment)
  const fetched = await install.registry(AbortSignal.timeout(60_000)).fetch(pin)
  await installTheme({ kind: 'package', data: fetched.data, pin, attestation: fetched.bundle }, { ...install.options, allowCode: true })
}

/** What the server reports and serves, which a preview must leave as it was. */
function snapshot(r: Rig): unknown {
  return { status: r.themeSwitch.status(), active: r.themeSwitch.active().runtime.digest, switches: [...r.switches], persisted: [...r.persisted] }
}

describe('the theme of a preview', () => {
  it('previews a code theme the image was not built with on the default slots and says a rebuild is needed to activate it', async () => {
    const fake = await registry()
    // The image is built with starter 0.1.0; this is another version of it, with its own slots, which no build compiled in
    const other = withSlots('starter', '2.0.0')
    publishAll(fake, [other], { starter: { code: true } })
    const r = await rig({ registry: fake })
    await installCentrally(r, fake, other.pin)
    const before = snapshot(r)

    const found = await r.themeSwitch.preview({ id: 'starter', version: '2.0.0' })
    expect(found).toMatchObject({ builtIn: false, rebuildToActivate: true })
    expect(found!.theme.runtime).toMatchObject({ id: 'starter', version: '2.0.0' })
    expect(found!.theme.entry.manifest.code).toBe(true)
    // From its data, on the core's default slots: the id is the compiled-in starter's, whose slots are not this version's
    const data = themeDataOf(found!.theme.runtime, false, !found!.builtIn)
    expect(data).toMatchObject({ id: 'starter', digest: found!.theme.runtime.digest, defaultSlots: true })
    expect(Object.isFrozen(data)).toBe(true)
    // /_t/ serves its files for the preview, and nothing else changed: no switch, no status, no download
    expect(r.themeSwitch.served(found!.theme.runtime.digest)).toBe(found!.theme)
    expect(snapshot(r)).toEqual(before)

    // Activation keeps refusing it (ADR 0009, section 4): only the preview renders it
    r.themeSwitch.observe({ themeId: 'starter', themeVersion: '2.0.0', themeDigest: other.pin.digest })
    await r.settle()
    expect(r.themeSwitch.active().runtime.id).toBe('minimal')
    expect(r.themeSwitch.status().error).toMatchObject({ rule: 'code' })
  })

  it('previews a theme of the built-in store at its version with its own slots, and a data-only theme of the deployment store on the default slots', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake })
    await installCentrally(r, fake, sample.pin)
    const before = snapshot(r)

    const starter = await r.themeSwitch.preview({ id: 'starter', version: '0.1.0' })
    expect(starter).toMatchObject({ builtIn: true, rebuildToActivate: false })
    expect(starter!.theme.runtime.id).toBe('starter')
    expect(themeDataOf(starter!.theme.runtime, false, !starter!.builtIn)).not.toHaveProperty('defaultSlots')

    const data = await r.themeSwitch.preview({ id: 'sample', version: '1.0.0' })
    expect(data).toMatchObject({ builtIn: false, rebuildToActivate: false })
    expect(data!.theme.runtime.id).toBe('sample')
    // Asked again within the grant's life, the same theme comes back without reading the store again
    expect(await r.themeSwitch.preview({ id: 'sample', version: '1.0.0' })).toBe(data)
    expect(snapshot(r)).toEqual(before)
  })

  it('answers null for a theme in no store, or at a version no store holds, and downloads and installs nothing', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const r = await rig({ registry: fake })
    const before = snapshot(r)
    for (const wanted of [{ id: 'sample', version: '1.0.0' }, { id: 'starter', version: '0.1.1' }, { id: 'absent', version: '1.0.0' }]) {
      expect(await r.themeSwitch.preview(wanted), JSON.stringify(wanted)).toBeNull()
    }
    expect(fake.seen).toEqual([])
    expect(existsSync(join(r.deployment, 'v1/entries'))).toBe(false)
    expect(snapshot(r)).toEqual(before)
    // Without a deployment store only the built-in themes can be previewed
    const bare = await rig({ install: null })
    expect(await bare.themeSwitch.preview({ id: 'sample', version: '1.0.0' })).toBeNull()
    expect(await bare.themeSwitch.preview({ id: 'starter', version: '0.1.0' })).toMatchObject({ builtIn: true })
  })

  it('does not preview an entry whose attestation does not verify, as the switch would not activate it', async () => {
    const fake = await registry()
    const sample = packaged('sample')
    publishAll(fake, [sample])
    const refusing = (): never => {
      throw new Error('refused')
    }
    const r = await rig({ registry: fake, install: { registry: () => ({ ...installFor(fake, '').registry(AbortSignal.abort()), verify: refusing }) } })
    await installCentrally(r, fake, sample.pin)
    expect(await r.themeSwitch.preview({ id: 'sample', version: '1.0.0' })).toBeNull()
  })

  it('serves a previewed theme under /_t/ for the life of a grant, then no longer', async () => {
    const r = await rig({ install: null })
    const found = await r.themeSwitch.preview({ id: 'starter', version: '0.1.0' })
    const digest = found!.theme.runtime.digest
    expect(r.themeSwitch.served(digest)).toBe(found!.theme)
    r.clock.now += 15 * 60_000 - 1
    expect(r.themeSwitch.served(digest)).toBe(found!.theme)
    r.clock.now += 1
    expect(r.themeSwitch.served(digest)).toBeUndefined()
  })

  it('serves at most four previewed themes at once, forgetting the oldest', async () => {
    const fake = await registry()
    const packages = ['one', 'two', 'three', 'four', 'five'].map(id => packaged(id))
    publishAll(fake, packages)
    const r = await rig({ registry: fake })
    const digests: string[] = []
    for (const { pin } of packages) {
      await installCentrally(r, fake, pin)
      digests.push((await r.themeSwitch.preview({ id: pin.id, version: pin.version }))!.theme.runtime.digest)
    }
    expect(r.themeSwitch.served(digests[0]!)).toBeUndefined()
    for (const digest of digests.slice(1)) expect(r.themeSwitch.served(digest)).toBeDefined()
  })
})

describe('the draft response of a preview', () => {
  // The server utils use Nitro's auto-imports, which are globals here: stand-ins for the few these touch
  function stubs(found: PreviewedTheme | null): { headers: Record<string, string>, warnings: unknown[] } {
    const headers: Record<string, string> = {}
    const warnings: unknown[] = []
    vi.stubGlobal('previewTheme', () => Promise.resolve(found))
    vi.stubGlobal('setHeader', (_event: unknown, name: string, value: string) => {
      headers[name] = value
    })
    vi.stubGlobal('logWarn', (...args: unknown[]) => warnings.push(args))
    return { headers, warnings }
  }
  const event = (): H3Event => ({ context: {}, node: { req: { headers: {} } } }) as unknown as H3Event

  it('says a rebuild is needed for a code theme the image was not built with, and pins the request to it on the default slots', async () => {
    const r = await rig({ install: null })
    const starter = (await r.themeSwitch.preview({ id: 'starter', version: '0.1.0' }))!
    const foreign: PreviewedTheme = { theme: starter.theme, builtIn: false, rebuildToActivate: true }
    const { headers } = stubs(foreign)
    const request = event()
    expect(await previewedTheme(request, { id: 'starter', version: '0.1.0' })).toBe(foreign)
    expect(headers).toEqual({ [THEME_PREVIEW_HEADER]: 'rebuild-required' })
    pinRequestToPreviewTheme(request, foreign)
    expect(request.context.activeTheme).toBe(starter.theme)
    expect(request.context.theme).toMatchObject({ id: 'starter', defaultSlots: true })
    expect(request.node.req.headers[THEME_HEADER]).toBe(starter.theme.runtime.digest)
  })

  it('says nothing for a theme the image was built with, which keeps its own slots', async () => {
    const r = await rig({ install: null })
    const starter = (await r.themeSwitch.preview({ id: 'starter', version: '0.1.0' }))!
    const { headers } = stubs(starter)
    const request = event()
    const found = await previewedTheme(request, { id: 'starter', version: '0.1.0' })
    expect(found).toBe(starter)
    pinRequestToPreviewTheme(request, found!)
    expect(headers).toEqual({})
    expect(request.context.theme).not.toHaveProperty('defaultSlots')
  })

  it('finds no theme that no store holds, and logs the id and version only', async () => {
    const { headers, warnings } = stubs(null)
    expect(await previewedTheme(event(), { id: 'absent', version: '1.0.0' })).toBeNull()
    expect(headers).toEqual({})
    expect(warnings).toEqual([['preview.theme-not-installed', expect.any(String), { event: expect.anything(), cause: 'absent@1.0.0' }]])
  })
})

// The draft pages whose theme a grant's override decides: the page of the draft route, as `/_preview` redirects to it, and nothing else
describe('previewDraftTarget', () => {
  it('reads the draft of every path previewDraftPath writes', () => {
    for (const [kind, documentId, locale] of [['article', 'doc-1', 'en'], ['page', 'doc page/ü', 'es'], ['page', 'p', null]] as const) {
      expect(previewDraftTarget(previewDraftPath(kind, documentId, locale, 'static', 3))).toEqual({ kind, documentId })
    }
    expect(previewDraftTarget('/drafts/doc-1')).toEqual({ kind: 'article', documentId: 'doc-1' })
    expect(previewDraftTarget('/es/drafts/pages/doc-1/')).toEqual({ kind: 'page', documentId: 'doc-1' })
  })

  it('is null for any other path, a file under a draft, its API route and a document id that is not valid percent-encoding', () => {
    for (const path of ['/', '/drafts', '/drafts/', '/api/drafts/doc-1', '/api/drafts/pages/doc-1', '/drafts/doc-1/_payload.json', '/fr/drafts/doc-1', '/blog/drafts/doc-1', '/drafts/%E0%A4%A']) {
      expect(previewDraftTarget(path), path).toBeNull()
    }
  })
})
