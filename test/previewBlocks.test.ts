import { describe, expect, it, vi } from 'vitest'
import { blockId, blockMarkers, droppedCounter, patchSections, readBlockMessage, throttled } from '../app/helpers/previewBlocks'
import { PREVIEW_PATCH_TEXT_FIELDS } from '../app/constants/preview'
import { PAGE_SECTION_COMPONENTS } from '../app/interfaces/page'
import type { BlockAddress, BlockPatch } from '../app/interfaces/preview'
import type { PageSection } from '../app/interfaces/page'

const VERSION = '2026-10-24T09:30:00.000Z'
const grid: BlockAddress = { zone: 'sections', index: 1, block: 'feature-grid', version: VERSION }
const envelope = (type: string, payload: unknown, v = 1): unknown => ({ v, type, payload })

describe('readBlockMessage', () => {
  it('reads a select with or without an item, and a clear', () => {
    expect(readBlockMessage(envelope('micelio:select', { address: grid, item: 2, reveal: true }), VERSION)).toEqual({ kind: 'select', request: { address: grid, item: 2, reveal: true } })
    expect(readBlockMessage(envelope('micelio:select', { address: grid }), VERSION)).toEqual({ kind: 'select', request: { address: grid, item: null, reveal: false } })
    expect(readBlockMessage(envelope('micelio:select', { address: null, item: 3 }), VERSION)).toEqual({ kind: 'select', request: { address: null, item: null, reveal: false } })
  })

  it('reads a hover', () => {
    expect(readBlockMessage(envelope('micelio:hover', { address: grid }), VERSION)).toEqual({ kind: 'hover', request: { address: grid, item: null } })
    expect(readBlockMessage(envelope('micelio:hover', { address: null }), VERSION)).toEqual({ kind: 'hover', request: { address: null, item: null } })
  })

  it('reads an insertGap after a block or at the top, and closes it with height 0', () => {
    const gap = { version: VERSION, zone: 'sections', after: 0, height: 48 }
    expect(readBlockMessage(envelope('micelio:insertGap', gap), VERSION)).toEqual({ kind: 'insertGap', request: gap })
    expect(readBlockMessage(envelope('micelio:insertGap', { ...gap, after: null, height: 0 }), VERSION)).toMatchObject({ kind: 'insertGap', request: { after: null, height: 0 } })
  })

  it('reads a patch of text and items', () => {
    const patch = { address: grid, content: { title: 'New' }, items: [{ index: 0, content: { text: 'Item' } }] }
    expect(readBlockMessage(envelope('micelio:patch', patch), VERSION)).toEqual({ kind: 'patch', request: patch })
    expect(readBlockMessage(envelope('micelio:patch', { address: grid, content: { title: null }, items: [] }), VERSION)).toMatchObject({ kind: 'patch', request: { items: [] } })
    expect(readBlockMessage(envelope('micelio:patch', { address: grid, content: { title: null } }), VERSION)).toEqual({ kind: 'malformed' })
  })

  it('calls a patch with a number or a boolean malformed: a patch carries text or null', () => {
    for (const content of [{ columns: 2 }, { wide: true }, { title: ['x'] }]) {
      expect(readBlockMessage(envelope('micelio:patch', { address: grid, content, items: [] }), VERSION)).toEqual({ kind: 'malformed' })
    }
  })

  it('reads a renderMode of a block, dynamic or static', () => {
    for (const mode of ['dynamic', 'static']) {
      expect(readBlockMessage(envelope('micelio:renderMode', { address: grid, mode }), VERSION)).toEqual({ kind: 'renderMode', request: { address: grid, mode } })
    }
    // A field that is not listed is ignored, so a later optional field is a MINOR (ADR 0019, section 4)
    expect(readBlockMessage(envelope('micelio:renderMode', { address: grid, mode: 'static', later: 1 }), VERSION)).toEqual({ kind: 'renderMode', request: { address: grid, mode: 'static' } })
  })

  it('calls a renderMode with another mode, no address or a stale one malformed', () => {
    const other = { ...grid, version: '2026-10-25T00:00:00.000Z' }
    for (const payload of [{ address: grid }, { address: grid, mode: 'Static' }, { address: grid, mode: 1 }, { mode: 'static' }, { address: null, mode: 'static' }, { address: other, mode: 'static' }]) {
      expect(readBlockMessage(envelope('micelio:renderMode', payload), VERSION), JSON.stringify(payload)).toEqual({ kind: 'malformed' })
    }
  })

  it('ignores what is well formed but not for it: another envelope version, other types', () => {
    for (const data of [envelope('micelio:select', { address: grid }, 2), envelope('load-draft', {}), envelope('block-select', {}), envelope('toString', {}), envelope('micelio:unknown', {}), { type: 'micelio:unknown' }]) {
      expect(readBlockMessage(data, VERSION), JSON.stringify(data)).toBeUndefined()
    }
  })

  it('calls a failed envelope malformed: not an object, no string type, no numeric v on a known type', () => {
    for (const data of ['micelio:select', null, undefined, 7, [], { type: 1 }, {}, { type: 'micelio:select' }, { type: 'micelio:select', v: '1', payload: {} }, { type: 'micelio:patch', v: null }]) {
      expect(readBlockMessage(data, VERSION), JSON.stringify(data)).toEqual({ kind: 'malformed' })
    }
  })

  it('calls a known type that fails its shape malformed', () => {
    const gap = { version: VERSION, zone: 'sections', after: 0, height: 48 }
    const patch = { address: grid, content: {}, items: [] }
    const cases: unknown[] = [
      envelope('micelio:select', null),
      envelope('micelio:select', {}),
      envelope('micelio:select', { address: { ...grid, zone: 'blocks' } }),
      envelope('micelio:select', { address: { ...grid, index: -1 } }),
      envelope('micelio:select', { address: { ...grid, index: 1.5 } }),
      envelope('micelio:select', { address: { ...grid, index: 10_000 } }),
      envelope('micelio:select', { address: { ...grid, block: 'Feature Grid' } }),
      envelope('micelio:select', { address: { ...grid, block: 3 } }),
      envelope('micelio:select', { address: { ...grid, version: '' } }),
      envelope('micelio:select', { address: { ...grid, version: 'x'.repeat(65) } }),
      envelope('micelio:select', { address: grid, item: -1 }),
      envelope('micelio:select', { address: grid, item: '1' }),
      envelope('micelio:hover', { address: 'hero' }),
      envelope('micelio:insertGap', { ...gap, after: -1 }),
      envelope('micelio:insertGap', { ...gap, zone: 'blocks' }),
      envelope('micelio:insertGap', { ...gap, version: 1 }),
      envelope('micelio:insertGap', { ...gap, height: -1 }),
      envelope('micelio:insertGap', { ...gap, height: 2001 }),
      envelope('micelio:insertGap', { ...gap, height: Number.NaN }),
      envelope('micelio:insertGap', { ...gap, height: '48' }),
      envelope('micelio:patch', { content: {}, items: [] }),
      envelope('micelio:patch', { ...patch, content: null }),
      envelope('micelio:patch', { ...patch, content: { html: '<p>x</p>' } }),
      envelope('micelio:patch', { ...patch, content: { id: 9 } }),
      envelope('micelio:patch', { ...patch, content: { __component: 'section.hero' } }),
      envelope('micelio:patch', { ...patch, content: JSON.parse('{"__proto__": "x"}') }),
      envelope('micelio:patch', { ...patch, content: { media: { url: '/x' } } }),
      envelope('micelio:patch', { ...patch, content: { title: 'x'.repeat(10_001) } }),
      envelope('micelio:patch', { ...patch, content: { count: Number.POSITIVE_INFINITY } }),
      envelope('micelio:patch', { ...patch, items: 'none' }),
      envelope('micelio:patch', { ...patch, items: Array.from({ length: 101 }, (_, index) => ({ index, content: {} })) }),
      envelope('micelio:patch', { ...patch, items: [null] }),
      envelope('micelio:patch', { ...patch, items: [{ index: -1, content: {} }] }),
      envelope('micelio:patch', { ...patch, items: [{ index: 0, content: { html: 'x' } }] }),
      envelope('micelio:patch', { ...patch, items: [{ index: 0 }] }),
    ]
    for (const data of cases) expect(readBlockMessage(data, VERSION), JSON.stringify(data)).toEqual({ kind: 'malformed' })
  })

  it('calls a message for another version of the draft stale, which is malformed too', () => {
    const other = { ...grid, version: '2026-10-25T00:00:00.000Z' }
    expect(readBlockMessage(envelope('micelio:select', { address: other }), VERSION)).toEqual({ kind: 'malformed' })
    expect(readBlockMessage(envelope('micelio:hover', { address: other }), VERSION)).toEqual({ kind: 'malformed' })
    expect(readBlockMessage(envelope('micelio:patch', { address: other, content: {}, items: [] }), VERSION)).toEqual({ kind: 'malformed' })
    expect(readBlockMessage(envelope('micelio:insertGap', { version: other.version, zone: 'sections', after: null, height: 1 }), VERSION)).toEqual({ kind: 'malformed' })
  })
})

describe('the markers of a block', () => {
  it('names the catalogue id without the namespace, and the position', () => {
    expect(blockId('section.feature-grid')).toBe('feature-grid')
    expect(blockId('hero')).toBe('hero')
    expect(blockMarkers('section.hero', 3)).toEqual({ 'data-myc-block': 'hero', 'data-myc-index': '3' })
  })
})

describe('patchSections', () => {
  const hero = { __component: 'section.hero', variant: 'split', title: 'Hello', text: null, media: { url: '/a.png' } } as unknown as PageSection
  const unknown = { __component: 'section.not-rendered', title: 'x' } as unknown as PageSection
  const features = {
    __component: 'section.feature-grid',
    id: 2,
    variant: 'grid',
    title: 'What you need',
    items: [{ title: 'Light', text: null }, { title: 'Pots', text: 'Ten' }],
  } as unknown as PageSection
  const sections = [hero, unknown, features]
  const patch = (index: number, block: string, content: BlockPatch['content'], items: BlockPatch['items'] = []): BlockPatch => ({ address: { zone: 'sections', index, block, version: VERSION }, content, items })

  it('writes text over text, and over an empty field, without touching the others', () => {
    const next = patchSections(sections, patch(0, 'hero', { title: 'Changed', text: 'Now there is text' }))!
    expect(next[0]).toEqual({ ...hero, title: 'Changed', text: 'Now there is text' })
    expect(next[1]).toBe(unknown)
    expect(next[2]).toBe(features)
    expect((hero as unknown as { title: string }).title).toBe('Hello')
  })

  it('counts the sections the frontend renders, the ones it does not know left out', () => {
    const next = patchSections(sections, patch(1, 'feature-grid', { title: 'Changed' }))!
    expect(next[2]).toMatchObject({ title: 'Changed' })
  })

  it('patches items by position and keeps the other items', () => {
    const next = patchSections(sections, patch(1, 'feature-grid', {}, [{ index: 1, content: { title: 'Planters', text: null } }]))!
    expect((next[2] as unknown as { items: unknown[] }).items).toEqual([{ title: 'Light', text: null }, { title: 'Planters', text: null }])
    expect((features as unknown as { items: Array<{ title: string }> }).items[1]!.title).toBe('Pots')
  })

  it('patches the plans, logos or images of a block as its items', () => {
    const pricing = { __component: 'section.pricing', plans: [{ name: 'Starter', price: '$5' }] } as unknown as PageSection
    const next = patchSections([pricing], patch(0, 'pricing', {}, [{ index: 0, content: { price: '$6' } }]))!
    expect((next[0] as unknown as { plans: unknown[] }).plans).toEqual([{ name: 'Starter', price: '$6' }])
  })

  it('refuses a patch that does not fit, whole', () => {
    expect(patchSections(sections, patch(5, 'hero', { title: 'x' }))).toBeUndefined()
    expect(patchSections(sections, patch(1, 'hero', { title: 'x' }))).toBeUndefined()
    expect(patchSections(undefined, patch(0, 'hero', { title: 'x' }))).toBeUndefined()
    expect(patchSections(null, patch(0, 'hero', { title: 'x' }))).toBeUndefined()
    // an object field cannot be replaced by a scalar, and a text field not by a number
    expect(patchSections(sections, patch(0, 'hero', { media: 'x' }))).toBeUndefined()
    expect(patchSections(sections, patch(0, 'hero', { title: 3 as unknown as string }))).toBeUndefined()
    expect(patchSections(sections, patch(0, 'hero', { title: true as unknown as string }))).toBeUndefined()
    // an item that is not there, and a block that has no items
    expect(patchSections(sections, patch(1, 'feature-grid', {}, [{ index: 2, content: { title: 'x' } }]))).toBeUndefined()
    expect(patchSections(sections, patch(0, 'hero', {}, [{ index: 0, content: { title: 'x' } }]))).toBeUndefined()
    // one bad field refuses the item and with it the whole patch
    expect(patchSections(sections, patch(1, 'feature-grid', { title: 'Changed' }, [{ index: 0, content: { title: 4 as unknown as string } }]))).toBeUndefined()
  })
})

describe('the text fields of a patch', () => {
  const sections = [
    { __component: 'section.hero', variant: 'split', title: 'Hello', media: { url: '/a.png' } },
    { __component: 'section.media-showcase', variant: 'left', title: 'Show', html: '<p>x</p>', media: { url: '/a.png', mime: 'image/png' } },
    { __component: 'section.gallery', variant: 'grid', images: [{ url: '/a.png', mime: 'image/png', alternativeText: 'A' }] },
    { __component: 'section.logo-cloud', variant: 'row', logos: [{ name: 'Acme', url: 'https://example.com', image: { url: '/l.png' } }] },
    { __component: 'section.rich-text', html: '<p>x</p>' },
  ] as unknown as PageSection[]
  const patch = (index: number, block: string, content: BlockPatch['content'], items: BlockPatch['items'] = []): BlockPatch => ({ address: { zone: 'sections', index, block, version: VERSION }, content, items })

  it('refuses a link written over a section that has none, which the component would fail to render', () => {
    expect(patchSections(sections, patch(0, 'hero', { primaryLink: 'x' }))).toBeUndefined()
    expect(patchSections(sections, patch(1, 'media-showcase', { link: 'x' }))).toBeUndefined()
  })

  it('refuses the fields the server validates: urls, mime types, variants, the media and the html', () => {
    expect(patchSections(sections, patch(0, 'hero', { variant: 'full-bleed' }))).toBeUndefined()
    expect(patchSections(sections, patch(1, 'media-showcase', { mime: 'text/html' }))).toBeUndefined()
    expect(patchSections(sections, patch(2, 'gallery', {}, [{ index: 0, content: { url: 'https://example.net/x.png' } }]))).toBeUndefined()
    expect(patchSections(sections, patch(2, 'gallery', {}, [{ index: 0, content: { mime: 'video/mp4' } }]))).toBeUndefined()
    expect(patchSections(sections, patch(3, 'logo-cloud', {}, [{ index: 0, content: { url: 'https://example.net' } }]))).toBeUndefined()
    expect(patchSections(sections, patch(4, 'rich-text', { html: '<p>y</p>' }))).toBeUndefined()
    expect(patchSections(sections, patch(4, 'rich-text', { title: 'y' }))).toBeUndefined()
  })

  it('writes the text fields of the contract, to text or null', () => {
    const gallery = patchSections(sections, patch(2, 'gallery', {}, [{ index: 0, content: { alternativeText: 'B' } }]))!
    expect((gallery[2] as unknown as { images: unknown[] }).images).toEqual([{ url: '/a.png', mime: 'image/png', alternativeText: 'B' }])
    const logos = patchSections(sections, patch(3, 'logo-cloud', { title: null }, [{ index: 0, content: { name: 'Acme Inc' } }]))!
    expect((logos[3] as unknown as { logos: Array<{ name: unknown }> }).logos[0]!.name).toBe('Acme Inc')
    expect((logos[3] as unknown as { title: unknown }).title).toBeNull()
  })

  it('refuses null and blank text over a field the server requires, and keeps null for an optional one', () => {
    const cta = [{ __component: 'section.cta', variant: 'banner', title: 'Go', text: 'Now' }] as unknown as PageSection[]
    const stats = [{ __component: 'section.stats', variant: 'row', items: [{ value: '3', label: 'Sites' }] }] as unknown as PageSection[]
    for (const title of [null, '', '   ']) expect(patchSections(sections, patch(0, 'hero', { title }))).toBeUndefined()
    expect(patchSections(cta, patch(0, 'cta', { title: null }))).toBeUndefined()
    expect(patchSections(cta, patch(0, 'cta', { title: ' \n ' }))).toBeUndefined()
    for (const value of [null, ' ']) expect(patchSections(stats, patch(0, 'stats', {}, [{ index: 0, content: { value } }]))).toBeUndefined()
    expect(patchSections(stats, patch(0, 'stats', {}, [{ index: 0, content: { label: null } }]))).toBeUndefined()
    expect(patchSections(sections, patch(3, 'logo-cloud', {}, [{ index: 0, content: { name: null } }]))).toBeUndefined()
    // text that is not blank, and null over an optional field, still fit
    expect(patchSections(cta, patch(0, 'cta', { title: 'Join', text: null }))).toEqual([{ ...cta[0], title: 'Join', text: null }])
    expect(patchSections(stats, patch(0, 'stats', { title: null }, [{ index: 0, content: { value: '4' } }]))).toBeDefined()
  })

  it('lists every block the page renders, so a new block is a decision about its fields', () => {
    expect(Object.keys(PREVIEW_PATCH_TEXT_FIELDS).sort()).toEqual([...PAGE_SECTION_COMPONENTS].sort())
  })

  it('pins the fields of the table, so a link, a count or a flag cannot be added unseen', () => {
    expect(PREVIEW_PATCH_TEXT_FIELDS).toEqual({
      'hero': { section: ['title', 'text'], item: [], required: { section: ['title'] } },
      'feature-grid': { section: ['title', 'text'], item: ['title', 'text'], required: { item: ['title'] } },
      'media-showcase': { section: ['title'], item: [] },
      'stats': { section: ['title'], item: ['value', 'label'], required: { item: ['value', 'label'] } },
      'logo-cloud': { section: ['title'], item: ['name'], required: { item: ['name'] } },
      'testimonials': { section: ['title'], item: ['quote', 'author', 'role'], required: { item: ['quote', 'author'] } },
      'pricing': { section: ['title', 'text'], item: ['name', 'price', 'period'], required: { item: ['name', 'price'] } },
      'faq': { section: ['title'], item: ['question'], required: { item: ['question'] } },
      'cta': { section: ['title', 'text'], item: [], required: { section: ['title'] } },
      'post-list': { section: ['title'], item: [] },
      'newsletter': { section: ['title', 'text', 'buttonLabel'], item: [] },
      'rich-text': { section: [], item: [] },
      'gallery': { section: ['title'], item: ['alternativeText'] },
      'scene': { section: ['title', 'text', 'alt'], item: [], required: { section: ['alt'] } },
    })
  })
})

describe('droppedCounter', () => {
  it('counts each drop and writes the count when it has a writer', () => {
    const write = vi.fn()
    const drop = droppedCounter(write)
    expect(drop()).toBe(1)
    expect(drop()).toBe(2)
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith('[micelio] preview: ignored 2 malformed or stale message(s) from the admin')
  })

  it('counts and writes nothing without a writer, as in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const drop = droppedCounter()
    expect(drop()).toBe(1)
    expect(drop()).toBe(2)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('throttled', () => {
  it('runs nothing after cancel: not the call that waits, not a later release', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const call = throttled(run, 100)
    call()
    call()
    call.cancel()
    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledTimes(1)
    call()
    expect(run).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('runs at once, then once per interval with the last call, and goes quiet when nobody calls', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const call = throttled(run, 100)
    call()
    expect(run).toHaveBeenCalledTimes(1)
    for (let tick = 0; tick < 20; tick++) call()
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(run).toHaveBeenCalledTimes(2)
    // The trailing run opened a new wait: a call inside it is held, and with none the next call is at once
    vi.advanceTimersByTime(100)
    expect(run).toHaveBeenCalledTimes(2)
    call()
    expect(run).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})
