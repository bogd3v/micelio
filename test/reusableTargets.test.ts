import qs from 'qs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import type { ReusableSection } from '../app/interfaces'
import { REUSABLE_BLOCK_POPULATE } from '../server/lib/constants'
import { readReusableTargets, resolveReusableTargets, reusableTargetIds } from '../server/utils/reusableTargets'

// The read of the targets of a page's references (ADR 0022, section 1): one filtered `GET /api/reusable-blocks` per page, published, in the page's locale
const context = { render: (markdown: string): string => `<p>${markdown}</p>`, siteUrl: 'https://notes.example.com', mediaOrigins: [] }
const strapiFetch = vi.fn()
const logError = vi.fn()

/** A reference as the page's parse leaves it: the target's document id only. */
const reference = (documentId: string, extra: Record<string, unknown> = {}): ReusableSection => ({ __component: 'section.reusable', reusableBlock: { documentId }, ...extra })
/** A reusable block's entry as the CMS answers the filtered read: its `blocks` zone of one block. */
const entry = (documentId: string, blocks: unknown[]): Record<string, unknown> => ({ id: 1, documentId, name: 'Internal', locale: 'en', blocks })
const cta = (title: string) => ({ id: 1, __component: 'section.cta', variant: 'card', title, text: null, primaryLink: null, secondaryLink: null })

/** The query of the n-th request to the CMS, as Strapi reads it. */
function sent(call = 0): { path: string, query: Record<string, unknown> } {
  const [url] = strapiFetch.mock.calls[call] as [string]
  const [path, search] = url.split('?') as [string, string]
  return { path, query: qs.parse(search, { depth: 20 }) as Record<string, unknown> }
}

beforeEach(() => {
  vi.stubGlobal('strapiFetch', strapiFetch)
  vi.stubGlobal('logError', logError)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('the targets of a page', () => {
  it('reads the distinct targets of a page in one filtered request, in the page\'s locale, and gives no block for a missing target, an invalid target or a failed read', async () => {
    strapiFetch.mockResolvedValueOnce({
      data: [
        entry('reusable-a', [cta('Join us')]),
        // A target with no valid block: a block that is a reference, one that carries a group, and one that fails its schema
        entry('reusable-b', [{ __component: 'section.reusable', reusableBlock: { documentId: 'reusable-a' } }]),
        entry('reusable-c', [{ ...cta('Grouped'), group: { groupId: 'band-1', tone: 'accent' } }]),
        entry('reusable-d', [{ ...cta('No title'), title: null }]),
        // An entry the read did not ask for is not used
        entry('reusable-x', [cta('Not asked')]),
      ],
      meta: {},
    })
    const sections = [
      reference('reusable-a', { group: { groupId: 'band-1', tone: 'accent' } }),
      { __component: 'section.hero', variant: 'centered', title: 'Hello' },
      reference('reusable-a'),
      reference('reusable-b'),
      reference('reusable-c'),
      reference('reusable-d'),
      // Unpublished, missing in the locale or of another site: the CMS does not answer it
      reference('reusable-missing'),
      // A reference with no target, and one that already carries its block (a grant bound to a reference), are not read
      { __component: 'section.reusable' },
      reference('reusable-draft', { block: { __component: 'section.cta', variant: 'banner', title: 'The block\'s draft' } }),
    ] as ReusableSection[]
    const resolved = await resolveReusableTargets(sections, 'es', context)

    expect(strapiFetch).toHaveBeenCalledTimes(1)
    const { path, query } = sent()
    expect(path).toBe('/api/reusable-blocks')
    expect(query).toEqual({
      filters: { documentId: { $in: ['reusable-a', 'reusable-b', 'reusable-c', 'reusable-d', 'reusable-missing'] } },
      locale: 'es',
      pagination: { page: '1', pageSize: '5' },
      populate: JSON.parse(JSON.stringify(REUSABLE_BLOCK_POPULATE), (_, value: unknown) => value === true ? 'true' : value),
    })
    // Strapi's default status is the published one: the read never asks for a draft
    expect(query).not.toHaveProperty('status')
    // The cached page passes no request: the CMS sees the server, as for the page itself
    expect(strapiFetch.mock.calls[0]![1]).toEqual({})

    expect(resolved.map(section => ((section as ReusableSection).block as { title?: string } | undefined)?.title ?? null)).toEqual(['Join us', null, 'Join us', null, null, null, null, null, 'The block\'s draft'])
    expect(resolved[0]).toMatchObject({ group: { groupId: 'band-1', tone: 'accent' }, block: { __component: 'section.cta', title: 'Join us' } })
    expect(resolved[1]).toBe(sections[1])
    for (const index of [3, 4, 5, 6, 7]) expect(resolved[index], String(index)).not.toHaveProperty('block')
    expect(resolved[8]).toBe(sections[8])

    // A page with no reference, or none to read, asks for nothing
    await expect(resolveReusableTargets([{ __component: 'section.hero' }, sections[8]!], 'en', context)).resolves.toHaveLength(2)
    await expect(readReusableTargets([], 'en')).resolves.toEqual(new Map())
    expect(strapiFetch).toHaveBeenCalledTimes(1)

    // A failed read gives no block, and the request of a visitor is passed on
    strapiFetch.mockRejectedValueOnce({ response: { status: 500 } })
    const event = { context: {} } as unknown as H3Event
    const failed = await resolveReusableTargets([reference('reusable-a')], 'en', context, event)
    expect(failed[0]).not.toHaveProperty('block')
    expect(strapiFetch.mock.calls[1]![1]).toEqual({ event })
    // An answer that is not a list gives none either
    strapiFetch.mockResolvedValueOnce({ data: { documentId: 'reusable-a', blocks: [cta('One')] } })
    expect((await resolveReusableTargets([reference('reusable-a')], 'en', context))[0]).not.toHaveProperty('block')
  })

  it('a failed target read is logged and the page still answers', async () => {
    const page = { id: 1, documentId: 'page-1', title: 'Home', slug: 'home', locale: 'en', sections: [{ id: 1, __component: 'section.hero', variant: 'centered', title: 'Hello' }, { id: 2, __component: 'section.reusable', reusableBlock: { id: 9, documentId: 'reusable-a' } }] }
    strapiFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/pages?')) return { data: [page] }
      throw Object.assign(new Error('fetch failed'), { response: { status: 502 } })
    })
    vi.stubGlobal('defineCachedFunction', (fetcher: unknown) => fetcher)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: 'https://notes.example.com', strapiUrl: 'https://cms.example.com' }, mediaUrl: '' }))
    vi.stubGlobal('markdownRenderer', () => ({ renderMarkdown: context.render }))
    vi.stubGlobal('upstreamFailure', (error: unknown) => error)
    const { loadPage } = await import('../server/utils/pageSections')

    const loaded = await (loadPage as unknown as (slug: string, locale: string) => Promise<{ sections: Array<Record<string, unknown>> }>)('home', 'en')
    expect(loaded.sections.map(section => section.__component)).toEqual(['section.hero', 'section.reusable'])
    expect(loaded.sections[1]).toEqual({ __component: 'section.reusable', reusableBlock: { documentId: 'reusable-a' } })
    expect(strapiFetch.mock.calls.map(([url]) => (url as string).split('?')[0])).toEqual(['/api/pages', '/api/reusable-blocks'])
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalledWith('cms.reusable-blocks', expect.any(String), { error: expect.anything() })

    // Read for a visitor, the line carries the request
    const event = { context: {} } as unknown as H3Event
    await readReusableTargets(['reusable-a'], 'en', event)
    expect(logError).toHaveBeenLastCalledWith('cms.reusable-blocks', expect.any(String), { error: expect.anything(), event })
  })

  it('the draft route reads the targets on each request, with the grant and with the editor session', async () => {
    const draft = { documentId: 'page-1', title: 'Home', slug: 'home', updatedAt: '2026-11-27T08:00:00.000Z', sections: [{ __component: 'section.reusable', reusableBlock: { id: 9, documentId: 'reusable-a' } }] }
    strapiFetch.mockResolvedValue({ data: [entry('reusable-a', [cta('Published')])] })
    const stubs: Record<string, unknown> = {
      defineEventHandler: (handler: unknown) => handler,
      preventCaching: () => {},
      getRouterParam: () => 'page-1',
      getQuery: () => ({ locale: 'es' }),
      draftLocale: () => 'es',
      draftNotFound: () => new Error('notFound'),
      previewContextDraft: () => null,
      previewContextReference: () => null,
      draftPreview: () => ({ adminOrigin: 'https://cms.example.com' }),
      fetchPreviewDraft: async () => ({ data: draft, actor: 'admin' }),
      editorSession: () => 'jwt',
      fetchAsEditor: async () => ({ data: draft }),
      useRuntimeConfig: () => ({ public: { siteUrl: 'https://notes.example.com', strapiUrl: 'https://cms.example.com' }, mediaUrl: '' }),
      markdownRenderer: () => ({ renderMarkdown: context.render }),
      resolvePostLists: async (sections: unknown[]) => sections,
    }
    for (const [name, value] of Object.entries(stubs)) vi.stubGlobal(name, value)
    const route = (await import('../server/api/drafts/pages/[documentId].get')).default as unknown as (event: H3Event) => Promise<{ page: { sections: ReusableSection[] } }>
    const event = { context: {} } as unknown as H3Event

    // The admin's grant
    vi.stubGlobal('previewAdminOrigin', () => 'https://cms.example.com')
    vi.stubGlobal('previewGrantOf', () => 'grant')
    expect((await route(event)).page.sections[0]!.block).toMatchObject({ __component: 'section.cta', title: 'Published' })
    // The editor's session
    vi.stubGlobal('previewAdminOrigin', () => '')
    expect((await route(event)).page.sections[0]!.block).toMatchObject({ title: 'Published' })
    // Each request reads them, in the draft's locale, for the visitor who asked
    expect(strapiFetch).toHaveBeenCalledTimes(2)
    for (const call of [0, 1]) {
      expect(sent(call).query).toMatchObject({ filters: { documentId: { $in: ['reusable-a'] } }, locale: 'es' })
      expect(strapiFetch.mock.calls[call]![1]).toEqual({ event })
    }
    expect(reusableTargetIds(draft.sections)).toEqual(['reusable-a'])
  })
})
