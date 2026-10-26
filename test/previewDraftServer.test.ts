import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { PREVIEW_DRAFT_CONTEXT_KEY } from '../app/constants/preview'
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

  it('refuses an empty answer', async () => {
    strapiFetch.mockResolvedValue({ data: null, meta: { actor: 'admin' } })
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).rejects.toMatchObject({ code: 'notFound' })
  })

  it.each([400, 401, 403, 404])('answers the draft 404 when the CMS answers %i', async (status) => {
    strapiFetch.mockRejectedValue(upstream(status))
    await expect(fetchPreviewDraft(event, 'g', 'doc-1', {})).rejects.toMatchObject({ code: 'notFound' })
    expect(logWarn.mock.calls.map(call => call[0])).toEqual(status === 401 || status === 403 ? ['config.preview-token'] : [])
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
