import qs from 'qs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { PREVIEW_DRAFT_CONTEXT_KEY } from '../app/constants/preview'
import { PAGE_POPULATE, REFERENCE_PAGE_POPULATE } from '../server/lib/constants'
import { fetchPreviewDraft, previewContextDraft } from '../server/utils/preview'

// The server utils use Nitro's auto-imports, which are globals here: stand-ins for the few the draft read touches
const strapiFetch = vi.fn()
const logWarn = vi.fn()
const logError = vi.fn()
const draftNotFound = () => Object.assign(new Error('notFound'), { code: 'notFound' })
const problem = (code: string) => Object.assign(new Error(code), { code })
const event = { context: {} } as unknown as H3Event
const upstream = (status: number) => ({ response: { status } })

beforeEach(() => {
  vi.stubGlobal('strapiFetch', strapiFetch)
  vi.stubGlobal('logWarn', logWarn)
  vi.stubGlobal('logError', logError)
  vi.stubGlobal('draftNotFound', draftNotFound)
  vi.stubGlobal('problem', problem)
  vi.stubGlobal('asUpstreamError', (error: unknown) => error)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('fetchPreviewDraft', () => {
  it('sends the API token\'s request with the grant in the header, and accepts an admin grant by default', async () => {
    strapiFetch.mockResolvedValue({ data: { documentId: 'doc-1' }, meta: { actor: 'admin' } })
    await expect(fetchPreviewDraft(event, 'the-grant', 'doc-1', { populate: '*' })).resolves.toEqual({ data: { documentId: 'doc-1' }, actor: 'admin' })
    expect(strapiFetch).toHaveBeenCalledWith('/api/micelio/preview/draft?populate=%2A&documentId=doc-1', { event, headers: { 'X-Micelio-Preview-Grant': 'the-grant' } })
  })

  it('refuses a system grant unless the route says it allows it, and says which actor it was when it does', async () => {
    strapiFetch.mockResolvedValue({ data: { documentId: 'doc-1' }, meta: { actor: 'system' } })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).rejects.toMatchObject({ code: 'notFound' })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {}, { allowSystem: false })).rejects.toMatchObject({ code: 'notFound' })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {}, { allowSystem: true })).resolves.toMatchObject({ actor: 'system' })
    // The weight route allows both: an admin grant is still accepted there
    strapiFetch.mockResolvedValue({ data: { documentId: 'doc-1' }, meta: { actor: 'admin' } })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {}, { allowSystem: true })).resolves.toMatchObject({ actor: 'admin' })
  })

  it.each([
    ['no meta', undefined],
    ['an empty meta', {}],
    ['an unknown actor', { actor: 'root' }],
    ['an actor that is not a string', { actor: ['admin'] }],
  ])('refuses an answer with %s, even when the route allows a system grant, and logs why', async (_, meta) => {
    strapiFetch.mockResolvedValue({ data: { documentId: 'doc-1' }, ...(meta !== undefined && { meta }) })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {}, { allowSystem: true })).rejects.toMatchObject({ code: 'notFound' })
    expect(logWarn).toHaveBeenCalledWith('config.preview-actor', expect.any(String), { event })
  })

  it('gives the theme override of an admin grant, and ignores one on a system grant\'s answer', async () => {
    const overrides = { theme: { id: 'starter', version: '0.1.0' } }
    strapiFetch.mockResolvedValue({ data: { documentId: 'doc-1' }, meta: { actor: 'admin', overrides } })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).resolves.toEqual({ data: { documentId: 'doc-1' }, actor: 'admin', overrides })
    // A system grant never carries one (ADR 0019, amendment of 2026-11-25): the weight report is always of the site's own theme
    strapiFetch.mockResolvedValue({ data: { documentId: 'doc-1' }, meta: { actor: 'system', overrides } })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {}, { allowSystem: true })).resolves.toEqual({ data: { documentId: 'doc-1' }, actor: 'system' })
  })

  it('refuses an answer whose theme override is outside the grammar of a pin, and logs why', async () => {
    strapiFetch.mockResolvedValue({ data: { documentId: 'doc-1' }, meta: { actor: 'admin', overrides: { theme: { id: '../x', version: '1.0.0' } } } })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).rejects.toMatchObject({ code: 'notFound' })
    expect(logWarn).toHaveBeenCalledWith('config.preview-actor', expect.any(String), { event })
  })

  it('refuses an empty answer', async () => {
    strapiFetch.mockResolvedValue({ data: null, meta: { actor: 'admin' } })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).rejects.toMatchObject({ code: 'notFound' })
  })

  it.each([401, 403, 404])('answers the draft 404 when the CMS answers %i', async (status) => {
    strapiFetch.mockRejectedValue(upstream(status))
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).rejects.toMatchObject({ code: 'notFound' })
    expect(logWarn.mock.calls.map(call => call[0])).toEqual(status === 401 || status === 403 ? ['config.preview-token'] : [])
  })

  it('logs config.preview-request when the CMS answers 400', async () => {
    strapiFetch.mockRejectedValue({ response: { status: 400 }, data: { detail: 'populate[sections][on][shared.playground] is not a component of the zone' }, message: 'a value of the request' })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).rejects.toMatchObject({ code: 'notFound' })
    expect(logWarn).toHaveBeenCalledTimes(1)
    expect(logWarn).toHaveBeenCalledWith('config.preview-request', expect.any(String), { event, cause: 'upstream 400' })
    expect(JSON.stringify(logWarn.mock.calls)).not.toContain('shared.playground')
    expect(JSON.stringify(logWarn.mock.calls)).not.toContain('a value of the request')
  })

  it('answers a 502 problem when the CMS fails any other way, and logs it', async () => {
    strapiFetch.mockRejectedValue(upstream(500))
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).rejects.toMatchObject({ code: 'upstreamUnavailable' })
    expect(logError).toHaveBeenCalledTimes(1)
  })

  it('never puts the grant in a log line', async () => {
    strapiFetch.mockRejectedValue(upstream(403))
    await expect(fetchPreviewDraft(event, 'secret-grant-value', 'doc-1', {})).rejects.toBeDefined()
    strapiFetch.mockResolvedValue({ data: {} })
    await expect(fetchPreviewDraft(event, 'secret-grant-value', 'doc-1', {})).rejects.toBeDefined()
    strapiFetch.mockRejectedValue(upstream(400))
    await expect(fetchPreviewDraft(event, 'secret-grant-value', 'doc-1', {})).rejects.toBeDefined()
    expect(JSON.stringify([logWarn.mock.calls, logError.mock.calls])).not.toContain('secret-grant-value')
  })
})

describe('previewContextDraft', () => {
  const held = (context: Record<string, unknown>) => ({ context }) as unknown as H3Event

  it('is null when the request did not come from the weight route', () => {
    expect(previewContextDraft(held({}), 'page', 'doc-1')).toBeNull()
  })

  it('returns the draft for the document and kind it was kept for', () => {
    const draft = { title: 'kept' }
    expect(previewContextDraft(held({ [PREVIEW_DRAFT_CONTEXT_KEY]: { kind: 'page', documentId: 'doc-1', draft } }), 'page', 'doc-1')).toBe(draft)
  })

  it('answers the draft 404 for another document or another kind', () => {
    const context = held({ [PREVIEW_DRAFT_CONTEXT_KEY]: { kind: 'page', documentId: 'doc-1', draft: {} } })
    expect(() => previewContextDraft(context, 'page', 'doc-2')).toThrow('notFound')
    expect(() => previewContextDraft(context, 'article', 'doc-1')).toThrow('notFound')
  })
})

// A system grant bound to a reference (ADR 0019, amendment of 2026-11-23; bogd3v/micelio#977): the weight route, the draft routes and the in-process renders, run with the stand-ins of their auto-imports
describe('a grant bound to a reference', () => {
  const ORIGIN = 'https://site.example.com'
  const PAGE_UID = 'api::page.page'
  const reusableBlock = { documentId: 'reusable-a', version: '2026-11-23T09:00:00.000Z' }
  const referenceMeta = { actor: 'system', measure: 'reference', reusableBlock }
  const draftBlock = { __component: 'section.cta', variant: 'banner', title: 'The block\'s draft' }
  /** The page's published version as the CMS answers a grant bound to a reference: the reference resolved to the block's draft. */
  const publishedPage = (updatedAt: string, documentId = 'page-1') => ({
    documentId,
    title: 'Home',
    slug: 'landing',
    updatedAt,
    sections: [
      { __component: 'section.hero', variant: 'centered', title: 'Welcome' },
      { __component: 'section.reusable', blockId: 'b1', reusableBlock: { documentId: 'reusable-a', name: 'Banner', blocks: [draftBlock] } },
    ],
  })
  const assertRateLimit = vi.fn()
  const rendered: string[] = []

  type Handler = (event: H3Event) => Promise<unknown>
  interface TestEvent {
    context: Record<string, unknown>
    query?: Record<string, string>
    node: { req: { headers: Record<string, string>, __unenv__?: Record<string, unknown> } }
    $fetch?: unknown
  }

  async function routes(): Promise<{ weight: Handler, draftPage: Handler, draftArticle: Handler, preview: Handler, carry: Handler }> {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    return {
      weight: (await import('../server/api/preview/[uid]/[documentId]/weight.get')).default as unknown as Handler,
      draftPage: (await import('../server/api/drafts/pages/[documentId].get')).default as unknown as Handler,
      draftArticle: (await import('../server/api/drafts/[documentId].get')).default as unknown as Handler,
      preview: (await import('../server/routes/_preview.get')).default as unknown as Handler,
      carry: (await import('../server/middleware/00-preview-draft')).default as unknown as Handler,
    }
  }

  /** Renders a draft path in process as `event.$fetch` does: the child gets the parent's context in `__unenv__`, the middleware carries the key, and the draft page route answers; its sections stand for the page's HTML. */
  function inProcess(parent: TestEvent, handlers: { draftPage: Handler, carry: Handler }) {
    return vi.fn(async (path: string, options: { onResponse: (context: { response: Response }) => void }) => {
      const url = new URL(path, ORIGIN)
      const documentId = decodeURIComponent(url.pathname.split('/').pop()!)
      const child: TestEvent = { context: { params: { documentId } }, query: Object.fromEntries(url.searchParams), node: { req: { headers: {}, __unenv__: parent.context } } }
      let html = ''
      let status = 200
      try {
        await handlers.carry(child as unknown as H3Event)
        const { page } = await handlers.draftPage(child as unknown as H3Event) as { page: { sections: unknown[] } }
        html = `<!doctype html><html><body>${page.sections.map(section => `<section>${JSON.stringify(section)}</section>`).join('')}</body></html>`
      } catch {
        status = 404
      }
      rendered.push(html)
      options.onResponse({ response: new Response(null, { status }) })
      return new TextEncoder().encode(html).buffer
    })
  }

  function weightRequest(handlers: { draftPage: Handler, carry: Handler }, query: Record<string, string>, documentId = 'page-1', headers: Record<string, string> = { 'x-micelio-preview-grant': 'system-grant' }): TestEvent {
    const event: TestEvent = { context: { params: { uid: PAGE_UID, documentId } }, query, node: { req: { headers: { ...headers } } } }
    event.$fetch = inProcess(event, handlers)
    return event
  }

  /** A `populate` as the CMS reads it from the query string. */
  const asSent = (populate: unknown): unknown => (qs.parse(qs.stringify({ populate }), { depth: 20 }) as { populate: unknown }).populate

  /** The `populate` of the draft read the route sent to the CMS. */
  function populateSent(call = 0): { sections: { on: Record<string, unknown> } } {
    const [path] = strapiFetch.mock.calls[call] as [string]
    return (qs.parse(path.split('?')[1]!, { depth: 20 }) as { populate: { sections: { on: Record<string, unknown> } } }).populate
  }

  beforeEach(async () => {
    rendered.length = 0
    const preview = await import('../server/utils/preview')
    const weight = await import('../server/utils/weight')
    const drafts = await import('../server/utils/drafts')
    const validation = await import('../server/utils/validation')
    vi.stubGlobal('fetchPreviewDraft', preview.fetchPreviewDraft)
    vi.stubGlobal('previewContextDraft', preview.previewContextDraft)
    vi.stubGlobal('previewContextReference', preview.previewContextReference)
    vi.stubGlobal('draftPreview', preview.draftPreview)
    vi.stubGlobal('redeemDraft', weight.redeemDraft)
    vi.stubGlobal('previewWeightReport', weight.previewWeightReport)
    vi.stubGlobal('draftLocale', drafts.draftLocale)
    vi.stubGlobal('editorSession', drafts.editorSession)
    vi.stubGlobal('validQuery', validation.validQuery)
    vi.stubGlobal('invalidQuery', validation.invalidQuery)
    vi.stubGlobal('assertRateLimit', assertRateLimit)
    vi.stubGlobal('preventCaching', () => {})
    vi.stubGlobal('setHeader', () => {})
    vi.stubGlobal('allowPreviewAdminOrigin', () => {})
    vi.stubGlobal('previewAdminOrigin', () => '')
    vi.stubGlobal('previewGrantOf', () => null)
    vi.stubGlobal('getSessionToken', () => null)
    vi.stubGlobal('clientIp', () => '192.0.2.1')
    vi.stubGlobal('getRequestHeader', (event: TestEvent, name: string) => event.node.req.headers[name.toLowerCase()])
    vi.stubGlobal('getRouterParams', (event: TestEvent) => event.context.params)
    vi.stubGlobal('getRouterParam', (event: TestEvent, name: string) => (event.context.params as Record<string, string> | undefined)?.[name])
    vi.stubGlobal('getQuery', (event: TestEvent) => event.query ?? {})
    vi.stubGlobal('getRequestURL', () => new URL(`${ORIGIN}/api/preview`))
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: ORIGIN, strapiUrl: 'https://cms.example.com' }, mediaUrl: '' }))
    vi.stubGlobal('loadSiteCached', async () => ({ site: { homePage: null } }))
    vi.stubGlobal('markdownRenderer', () => ({ renderMarkdown: (markdown: string) => `<p>${markdown}</p>` }))
    vi.stubGlobal('resolvePostLists', async (sections: unknown[]) => sections)
    // The public page of the document: not published at its path here, so the report takes the draft's own scripts
    vi.stubGlobal('$fetch', async (_: string, options: { onResponse: (context: { response: Response }) => void }) => {
      options.onResponse({ response: new Response(null, { status: 404 }) })
      return new ArrayBuffer(0)
    })
  })

  it('the weight route measures the page with the reusable block\'s draft for a reference grant', async () => {
    const handlers = await routes()
    // The page's own draft, measured first with a system grant of its own publish, at the same updatedAt
    strapiFetch.mockResolvedValueOnce({ data: { ...publishedPage('2026-11-23T08:00:00.000Z'), sections: [publishedPage('').sections[0]] }, meta: { actor: 'system' } })
    const own = await handlers.weight(weightRequest(handlers, { locale: 'en', mode: 'dynamic' }) as unknown as H3Event) as { data: { blocks: Array<{ id: string }> } }
    expect(own.data.blocks.map(block => block.id)).toEqual(['hero'])

    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:00:00.000Z'), meta: referenceMeta })
    rendered.length = 0
    const event = weightRequest(handlers, { locale: 'en', mode: 'dynamic', measure: 'reference' })
    const report = await handlers.weight(event as unknown as H3Event) as { data: { mode: string, htmlKb: number, blocks: Array<{ id: string, kb: number }> } }
    // Not the cached report of the page's own draft: the CMS was asked with this grant, once, and the copy it answered was rendered whole and once without each block
    expect(strapiFetch).toHaveBeenCalledTimes(2)
    expect(report.data.mode).toBe('dynamic')
    expect(report.data.blocks.map(block => block.id)).toEqual(['hero', 'reusable'])
    expect(report.data.blocks[1]!.kb).toBeGreaterThan(0)
    expect(event.$fetch).toHaveBeenCalledTimes(3)
    // The reference is drawn from the block its relation carries, the block's draft, turned into the reference's `block`
    expect(rendered[0]).toContain('"__component":"section.reusable","blockId":"b1","reusableBlock":{"documentId":"reusable-a"},"block":{"__component":"section.cta"')
    expect(rendered[0]).toContain('The block\'s draft')
    expect(rendered[2]).not.toContain('The block\'s draft')
    // The copy and the block travel in the request's context only, never in a header of the renders
    expect(event.context[PREVIEW_DRAFT_CONTEXT_KEY]).toMatchObject({ kind: 'page', documentId: 'page-1', reference: reusableBlock })
    expect(event.node.req.headers).toEqual({})

    // A copy that is not a reference grant's draws no block from a relation, whatever the relation carries
    const ordinary = { context: { params: { documentId: 'page-1' }, [PREVIEW_DRAFT_CONTEXT_KEY]: { kind: 'page', documentId: 'page-1', draft: publishedPage('2026-11-23T08:00:00.000Z') } }, query: {}, node: { req: { headers: {} } } } as unknown as H3Event
    const { page } = await handlers.draftPage(ordinary) as { page: { sections: Array<Record<string, unknown>> } }
    expect(page.sections[1]).toMatchObject({ __component: 'section.reusable', reusableBlock: { documentId: 'reusable-a' } })
    expect(page.sections[1]).not.toHaveProperty('block')

    // Another version of the block is another report
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:00:00.000Z'), meta: { ...referenceMeta, reusableBlock: { ...reusableBlock, version: '2026-11-23T09:05:00.000Z' } } })
    await handlers.weight(weightRequest(handlers, { locale: 'en', mode: 'dynamic', measure: 'reference' }) as unknown as H3Event)
    expect(rendered.length).toBe(6)
  })

  it('sends the populate that reaches the reusable block only with measure=reference', async () => {
    const handlers = await routes()
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:01:00.000Z'), meta: referenceMeta })
    await handlers.weight(weightRequest(handlers, { mode: 'dynamic', measure: 'reference' }) as unknown as H3Event)
    expect(populateSent(0)).toEqual(asSent(REFERENCE_PAGE_POPULATE))
    // A Node server answers 431 past 16 KiB of request line and headers: the line keeps 2 KiB for the headers (the API token, the grant, the forwarded address)
    const [sentPath] = strapiFetch.mock.calls[0] as [string]
    expect(sentPath.length).toBeLessThanOrEqual(14 * 1024)
    // The block's zone is the catalogue's: the plugin answers 400 to `section.rich-text` there, which only a page's zone keeps
    const { 'section.rich-text': _legacy, ...catalogue } = (asSent(PAGE_POPULATE) as typeof PAGE_POPULATE).sections.on
    expect(populateSent(0).sections.on['section.reusable']).toEqual({ populate: { group: 'true', reusableBlock: { populate: { blocks: { on: catalogue } } } } })

    // A system grant of the page's own publish, and an editor's grant, send today's populate
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:02:00.000Z'), meta: { actor: 'system' } })
    await handlers.weight(weightRequest(handlers, { mode: 'dynamic' }) as unknown as H3Event)
    vi.stubGlobal('previewAdminOrigin', () => 'https://cms.example.com')
    vi.stubGlobal('previewGrantOf', () => 'editor-grant')
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:03:00.000Z'), meta: { actor: 'admin' } })
    await handlers.weight(weightRequest(handlers, { mode: 'dynamic' }, 'page-1', {}) as unknown as H3Event)
    for (const call of [1, 2]) {
      expect(populateSent(call), String(call)).toEqual(asSent(PAGE_POPULATE))
      expect(Object.keys(populateSent(call).sections.on), String(call)).not.toContain('section.reusable')
    }
    expect(strapiFetch).toHaveBeenCalledTimes(3)

    // The marker on an article, or of another value, is the draft 404 before the CMS is asked
    const article = weightRequest(handlers, { measure: 'reference' })
    article.context.params = { uid: 'api::article.article', documentId: 'post-1' }
    await expect(handlers.weight(article as unknown as H3Event)).rejects.toMatchObject({ code: 'notFound' })
    for (const measure of ['', 'draft', 'Reference']) await expect(handlers.weight(weightRequest(handlers, { measure }) as unknown as H3Event), measure).rejects.toMatchObject({ code: 'notFound' })
    expect(strapiFetch).toHaveBeenCalledTimes(3)
    // A locale the route does not serve is still the 400
    await expect(handlers.weight(weightRequest(handlers, { locale: 'fr', measure: 'reference' }) as unknown as H3Event)).rejects.toMatchObject({ code: 'invalidRequest' })
  })

  it('refuses with the same 404 an answer whose meta.measure disagrees with the marker', async () => {
    const handlers = await routes()
    // The answer of a grant bound to a reference, without the marker
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:04:00.000Z'), meta: referenceMeta })
    const unmarked = weightRequest(handlers, { mode: 'dynamic' })
    await expect(handlers.weight(unmarked as unknown as H3Event)).rejects.toMatchObject({ code: 'notFound' })
    // The marker, with the answer of a grant that is not bound to a reference
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:05:00.000Z'), meta: { actor: 'system' } })
    const marked = weightRequest(handlers, { mode: 'dynamic', measure: 'reference' })
    await expect(handlers.weight(marked as unknown as H3Event)).rejects.toMatchObject({ code: 'notFound' })
    // The grant was sent, so spent, and nothing was rendered or counted against the document
    expect(strapiFetch).toHaveBeenCalledTimes(2)
    expect(unmarked.$fetch).not.toHaveBeenCalled()
    expect(marked.$fetch).not.toHaveBeenCalled()
    expect(assertRateLimit.mock.calls.map(call => call[1])).toEqual(['previewWeightSystemPerIp', 'previewWeightSystemPerIp'])
    // The same at the draft read
    strapiFetch.mockResolvedValue({ data: { documentId: 'page-1' }, meta: referenceMeta })
    await expect(fetchPreviewDraft(event, 'g', 'page-1', {}, { allowSystem: true })).rejects.toMatchObject({ code: 'notFound' })
    strapiFetch.mockResolvedValue({ data: { documentId: 'page-1' }, meta: { actor: 'system' } })
    await expect(fetchPreviewDraft(event, 'g', 'page-1', {}, { allowSystem: true, measure: 'reference' })).rejects.toMatchObject({ code: 'notFound' })
    strapiFetch.mockResolvedValue({ data: { documentId: 'page-1' }, meta: referenceMeta })
    await expect(fetchPreviewDraft(event, 'g', 'page-1', {}, { allowSystem: true, measure: 'reference' })).resolves.toEqual({ data: { documentId: 'page-1' }, actor: 'system', measure: 'reference', reusableBlock })
  })

  it('the draft routes and _preview refuse a reference grant', async () => {
    const handlers = await routes()
    vi.stubGlobal('previewAdminOrigin', () => 'https://cms.example.com')
    vi.stubGlobal('previewGrantOf', () => 'reference-grant')
    strapiFetch.mockResolvedValue({ data: publishedPage('2026-11-23T08:06:00.000Z'), meta: referenceMeta })
    const draftRequest = (documentId: string): H3Event => ({ context: { params: { documentId } }, query: {}, node: { req: { headers: {} } } }) as unknown as H3Event
    await expect(handlers.draftPage(draftRequest('page-1'))).rejects.toMatchObject({ code: 'notFound' })
    strapiFetch.mockResolvedValue({ data: { documentId: 'post-1', title: 'T', slug: 't', blocks: [] }, meta: referenceMeta })
    await expect(handlers.draftArticle(draftRequest('post-1'))).rejects.toMatchObject({ code: 'notFound' })
    // `/_preview` takes a token, which the CMS exchanges; it refuses a grant (bogd3v/micelio-plugin-core#260), so no cookie is set and nothing frames
    const setCookie = vi.fn()
    vi.stubGlobal('setPreviewGrantCookie', setCookie)
    vi.stubGlobal('exchangePreviewToken', (await import('../server/utils/preview')).exchangePreviewToken)
    vi.stubGlobal('sendRedirect', vi.fn())
    strapiFetch.mockRejectedValue(upstream(404))
    await expect(handlers.preview({ context: {}, query: { token: 'reference-grant' }, node: { req: { headers: {} } } } as unknown as H3Event)).rejects.toMatchObject({ code: 'notFound' })
    expect(setCookie).not.toHaveBeenCalled()
    // Even inherited in process, a copy for another document is the 404
    const inherited = { context: { params: { documentId: 'page-2' } }, query: {}, node: { req: { headers: {} } } } as unknown as H3Event
    inherited.context[PREVIEW_DRAFT_CONTEXT_KEY] = { kind: 'page', documentId: 'page-1', draft: publishedPage(''), reference: reusableBlock }
    await expect(handlers.draftPage(inherited)).rejects.toMatchObject({ code: 'notFound' })
  })

  it('a reference grant for another page than the path\'s is refused with the same 404', async () => {
    const handlers = await routes()
    // The CMS answered another page than the one in the path
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:07:00.000Z', 'page-2'), meta: referenceMeta })
    const other = weightRequest(handlers, { mode: 'dynamic', measure: 'reference' })
    await expect(handlers.weight(other as unknown as H3Event)).rejects.toMatchObject({ code: 'notFound' })
    // The CMS refuses a grant bound to another page: its 404 is the route's
    strapiFetch.mockRejectedValueOnce(upstream(404))
    const refused = weightRequest(handlers, { mode: 'dynamic', measure: 'reference' }, 'page-3')
    await expect(handlers.weight(refused as unknown as H3Event)).rejects.toMatchObject({ code: 'notFound' })
    expect(other.$fetch).not.toHaveBeenCalled()
    expect(refused.$fetch).not.toHaveBeenCalled()
    expect(assertRateLimit.mock.calls.map(call => call[1])).not.toContain('previewWeightPerDocument')
  })

  it('refuses an answer with an unknown meta.measure, and logs why', async () => {
    const metas: Array<[string, unknown]> = [
      ['a measure of another value', { actor: 'system', measure: 'draft', reusableBlock }],
      ['a measure that is not a string', { actor: 'system', measure: ['reference'], reusableBlock }],
      ['a measure without the reusable block', { actor: 'system', measure: 'reference' }],
      ['a reusable block without a measure', { actor: 'system', reusableBlock }],
      ['a measure on an admin grant\'s answer', { actor: 'admin', measure: 'reference', reusableBlock }],
      ['a reusable block without a version', { actor: 'system', measure: 'reference', reusableBlock: { documentId: 'reusable-a' } }],
    ]
    for (const [name, meta] of metas) {
      logWarn.mockClear()
      strapiFetch.mockResolvedValue({ data: { documentId: 'page-1' }, meta })
      await expect(fetchPreviewDraft(event, 'secret-grant-value', 'page-1', {}, { allowSystem: true, measure: 'reference' }), name).rejects.toMatchObject({ code: 'notFound' })
      expect(logWarn, name).toHaveBeenCalledWith('config.preview-actor', expect.any(String), { event })
      expect(JSON.stringify(logWarn.mock.calls), name).not.toContain('secret-grant-value')
    }
  })

  it('a reference grant counts against the per-document limit of the page in the path', async () => {
    const handlers = await routes()
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:08:00.000Z'), meta: referenceMeta })
    await handlers.weight(weightRequest(handlers, { mode: 'dynamic', measure: 'reference' }) as unknown as H3Event)
    expect(assertRateLimit.mock.calls.map(call => call.slice(1))).toEqual([['previewWeightSystemPerIp', '192.0.2.1'], ['previewWeightPerDocument', `${PAGE_UID}:page-1`]])
    // Over the limit, the report is not rendered
    assertRateLimit.mockImplementation((_: unknown, bucket: string) => {
      if (bucket === 'previewWeightPerDocument') throw problem('tooManyRequests')
    })
    strapiFetch.mockResolvedValueOnce({ data: publishedPage('2026-11-23T08:09:00.000Z'), meta: referenceMeta })
    const limited = weightRequest(handlers, { mode: 'dynamic', measure: 'reference' })
    await expect(handlers.weight(limited as unknown as H3Event)).rejects.toMatchObject({ code: 'tooManyRequests' })
    expect(limited.$fetch).not.toHaveBeenCalled()
  })
})
