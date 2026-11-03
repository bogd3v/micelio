import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import type { PropType } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { PREVIEW_REPORT_INTERVAL_MS } from '~/constants/preview'
import type { PreviewFrame } from '~/interfaces'

const ADMIN = 'https://cms.example.com'
const frame: PreviewFrame = { adminOrigin: ADMIN, documentId: 'doc-1', locale: 'en', version: '2026-10-24T09:30:00.000Z' }
const loadDraft = { v: 1, type: 'load-draft', payload: { documentId: 'doc-1', locale: 'en' } }

const Frame = defineComponent({
  props: { locale: { type: String as PropType<string | null>, default: 'en' } },
  setup(props) {
    usePreviewFrame({ ...frame, locale: props.locale })
    return () => null
  },
})

describe('usePreviewFrame', () => {
  const posted: Array<{ message: unknown, origin: string }> = []
  const parent = { postMessage: (message: unknown, origin: string): number => posted.push({ message, origin }) } as unknown as Window
  let reload: ReturnType<typeof vi.fn>
  let original: PropertyDescriptor | undefined

  beforeEach(() => {
    posted.length = 0
    original = Object.getOwnPropertyDescriptor(window, 'parent')
    Object.defineProperty(window, 'parent', { value: parent, configurable: true })
    reload = vi.fn()
    Object.defineProperty(window.location, 'reload', { value: reload, configurable: true })
  })

  afterEach(() => {
    if (original) Object.defineProperty(window, 'parent', original)
    else Reflect.deleteProperty(window, 'parent')
  })

  function send(data: unknown, init: { origin?: string, source?: unknown } = {}): void {
    window.dispatchEvent(new MessageEvent('message', { data, origin: init.origin ?? ADMIN, source: ('source' in init ? init.source : parent) as MessageEventSource }))
  }

  it('says ready to the admin origin, never to any origin', async () => {
    const wrapper = await mountSuspended(Frame)
    expect(posted).toEqual([{ origin: ADMIN, message: { v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-1', locale: 'en', version: frame.version } } }])
    wrapper.unmount()
  })

  it('loads the draft again on a load-draft for its own document and locale', async () => {
    const wrapper = await mountSuspended(Frame)
    send(loadDraft)
    expect(reload).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('drops a message from another origin or another window', async () => {
    const wrapper = await mountSuspended(Frame)
    send(loadDraft, { origin: 'https://evil.example.com' })
    send(loadDraft, { origin: 'http://cms.example.com' })
    send(loadDraft, { source: window })
    send(loadDraft, { source: null })
    expect(reload).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('drops a message that fails the schema, another document or locale, ready, and an unknown type', async () => {
    const wrapper = await mountSuspended(Frame)
    send({ ...loadDraft, v: 2 })
    send({ v: 1, type: 'load-draft', payload: { documentId: 'doc-1' } })
    send({ ...loadDraft, payload: { documentId: 'doc-2', locale: 'en' } })
    send({ ...loadDraft, payload: { documentId: 'doc-1', locale: 'es' } })
    send({ ...loadDraft, payload: { documentId: 'doc-1', locale: null } })
    send({ v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-1', locale: 'en', version: 'x' } })
    send({ v: 1, type: 'block-select', payload: { zone: 'sections', index: 0, block: 'hero', version: 'x' } })
    send('load-draft')
    send(null)
    expect(reload).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('reads the load-draft of a draft that is not localised by its null locale, and says null in ready', async () => {
    const wrapper = await mountSuspended(Frame, { props: { locale: null } })
    expect(posted[0]?.message).toMatchObject({ payload: { documentId: 'doc-1', locale: null } })
    send({ ...loadDraft, payload: { documentId: 'doc-1', locale: 'en' } })
    expect(reload).not.toHaveBeenCalled()
    send({ ...loadDraft, payload: { documentId: 'doc-1', locale: null } })
    expect(reload).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('stops listening once the page is gone', async () => {
    const wrapper = await mountSuspended(Frame)
    wrapper.unmount()
    send(loadDraft)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does nothing outside a frame', async () => {
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
    const wrapper = await mountSuspended(Frame)
    send(loadDraft, { source: window })
    expect(posted).toEqual([])
    expect(reload).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

// Phase 2 (ADR 0019, amendment of 2026-11-02): the page reports the geometry of the blocks it shows and accepts the admin's selection, hover, gap and patch
describe('usePreviewFrame with blocks', () => {
  const posted: Array<{ message: { type: string, payload: Record<string, unknown> }, origin: string }> = []
  const parent = { postMessage: (message: never, origin: string): number => posted.push({ message, origin }) } as unknown as Window
  const version = frame.version
  const address = (index: number, block: string) => ({ zone: 'sections', index, block, version })
  const patch = vi.fn<(patch: unknown) => boolean>()
  let original: PropertyDescriptor | undefined
  let observers: Array<{ callback: () => void, targets: Element[] }>
  let warn: ReturnType<typeof vi.spyOn>
  const disconnect = vi.fn()

  const Blocks = defineComponent({
    setup() {
      usePreviewFrame(frame, { patch })
      return () => null
    },
  })

  function rect(element: Element, top: number, height: number): void {
    element.getBoundingClientRect = (): DOMRect => ({ left: 0, top, width: 800, height, right: 800, bottom: top + height, x: 0, y: top, toJSON: () => ({}) })
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    posted.length = 0
    patch.mockReset().mockReturnValue(true)
    observers = []
    disconnect.mockReset()
    vi.stubGlobal('ResizeObserver', class {
      callback: () => void
      targets: Element[] = []
      disconnect = disconnect
      constructor(callback: () => void) {
        this.callback = callback
        observers.push(this)
      }

      observe(target: Element): void { this.targets.push(target) }
      unobserve(): void {}
    })
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    original = Object.getOwnPropertyDescriptor(window, 'parent')
    Object.defineProperty(window, 'parent', { value: parent, configurable: true })
    document.body.innerHTML = `
      <div data-myc-zone="sections">
        <section data-myc-block="hero" data-myc-index="0"><a href="/x">Go</a></section>
        <section data-myc-block="feature-grid" data-myc-index="1">
          <ul><li class="myc-section-item"><h3>One</h3></li><li class="myc-section-item"><h3>Two</h3></li></ul>
        </section>
      </div>`
    const [hero, grid] = [...document.querySelectorAll('[data-myc-block]')]
    rect(hero!, 0, 300)
    rect(grid!, 300, 400)
    rect(document.querySelectorAll('.myc-section-item')[1]!, 320, 100)
    rect(document.querySelectorAll('.myc-section-item')[0]!, 320, 100)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    warn.mockRestore()
    document.body.innerHTML = ''
    if (original) Object.defineProperty(window, 'parent', original)
    else Reflect.deleteProperty(window, 'parent')
  })

  function send(data: unknown, init: { origin?: string, source?: unknown } = {}): void {
    window.dispatchEvent(new MessageEvent('message', { data, origin: init.origin ?? ADMIN, source: ('source' in init ? init.source : parent) as MessageEventSource }))
  }

  const types = (): string[] => posted.map(entry => entry.message.type)
  const last = (type: string) => posted.filter(entry => entry.message.type === type).at(-1)?.message.payload as Record<string, unknown>

  it('says ready, then reports every block and the items inside the grid, to the admin origin only', async () => {
    const wrapper = await mountSuspended(Blocks)
    expect(types()).toEqual(['ready', 'micelio:blocks'])
    expect(posted.every(entry => entry.origin === ADMIN)).toBe(true)
    const report = last('micelio:blocks') as { version: string, blocks: Array<{ address: unknown, box: unknown, items: unknown[] }> }
    expect(report.version).toBe(version)
    expect(report.blocks.map(block => block.address)).toEqual([address(0, 'hero'), address(1, 'feature-grid')])
    expect(report.blocks[1]!.box).toEqual({ x: 0, y: 300, width: 800, height: 400 })
    expect(report.blocks[1]!.items).toHaveLength(2)
    wrapper.unmount()
  })

  it('reports again when the page reflows, no more than once an interval, and ends with the last state', async () => {
    const wrapper = await mountSuspended(Blocks)
    posted.length = 0
    const callback = observers.at(-1)!.callback
    for (let tick = 0; tick < 20; tick++) callback()
    // The first reflow is reported at once, the twenty that follow in one report at the end of the interval
    expect(types()).toEqual(['micelio:blocks'])
    vi.advanceTimersByTime(PREVIEW_REPORT_INTERVAL_MS)
    expect(types()).toEqual(['micelio:blocks', 'micelio:blocks'])
    expect(observers.at(-1)!.targets).toContain(document.querySelector('[data-myc-zone]'))
    wrapper.unmount()
  })

  it('selects the block or item the admin names and answers with its box', async () => {
    const wrapper = await mountSuspended(Blocks)
    const scrollIntoView = vi.fn()
    const grid = document.querySelector<HTMLElement>('[data-myc-index="1"]')!
    grid.scrollIntoView = scrollIntoView
    send({ v: 1, type: 'micelio:select', payload: { address: address(1, 'feature-grid'), item: null, reveal: true } })
    expect(last('micelio:selected')).toEqual({ address: address(1, 'feature-grid'), item: null, box: { x: 0, y: 300, width: 800, height: 400 } })
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    send({ v: 1, type: 'micelio:select', payload: { address: address(1, 'feature-grid'), item: 1 } })
    expect(last('micelio:selected')).toMatchObject({ item: 1, box: { y: 320, height: 100 } })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    send({ v: 1, type: 'micelio:select', payload: { address: null } })
    expect(last('micelio:selected')).toEqual({ address: null, item: null, box: null })
    wrapper.unmount()
  })

  it('answers a hover of the admin with the box, and reports the pointer of the page', async () => {
    const wrapper = await mountSuspended(Blocks)
    send({ v: 1, type: 'micelio:hover', payload: { address: address(0, 'hero') } })
    expect(last('micelio:hovered')).toMatchObject({ address: address(0, 'hero'), box: { height: 300 } })
    posted.length = 0
    const title = document.querySelectorAll('h3')[1]!
    title.dispatchEvent(new Event('pointermove', { bubbles: true }))
    title.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(types()).toEqual(['micelio:hovered'])
    expect(last('micelio:hovered')).toMatchObject({ address: address(1, 'feature-grid'), item: 1 })
    document.documentElement.dispatchEvent(new Event('pointerleave'))
    document.documentElement.dispatchEvent(new Event('pointerleave'))
    expect(last('micelio:hovered')).toEqual({ address: null, item: null, box: null })
    expect(types()).toEqual(['micelio:hovered', 'micelio:hovered'])
    wrapper.unmount()
  })

  it('selects on a click inside a block and does not follow its link; a click outside does nothing', async () => {
    const wrapper = await mountSuspended(Blocks)
    posted.length = 0
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.querySelector('a')!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(last('micelio:selected')).toMatchObject({ address: address(0, 'hero'), item: null })
    const outside = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(outside)
    expect(outside.defaultPrevented).toBe(false)
    expect(types()).toEqual(['micelio:selected'])
    wrapper.unmount()
  })

  it('opens a gap after a block on insertGap and reports the reflow', async () => {
    const wrapper = await mountSuspended(Blocks)
    posted.length = 0
    send({ v: 1, type: 'micelio:insertGap', payload: { version, zone: 'sections', after: 0, height: 64 } })
    const gap = document.querySelector<HTMLElement>('[data-myc-gap]')!
    expect(gap.style.height).toBe('64px')
    expect(gap.previousElementSibling?.getAttribute('data-myc-block')).toBe('hero')
    send({ v: 1, type: 'micelio:insertGap', payload: { version, zone: 'sections', after: 0, height: 0 } })
    expect(document.querySelector('[data-myc-gap]')).toBeNull()
    wrapper.unmount()
  })

  it('hands a patch to the page and reports once Vue has rendered it; a patch the page refuses is dropped', async () => {
    const wrapper = await mountSuspended(Blocks)
    posted.length = 0
    const message = { v: 1, type: 'micelio:patch', payload: { address: address(0, 'hero'), content: { title: 'New' }, items: [] } }
    send(message)
    expect(patch).toHaveBeenCalledWith({ address: address(0, 'hero'), content: { title: 'New' }, items: [] })
    await nextTick()
    vi.advanceTimersByTime(PREVIEW_REPORT_INTERVAL_MS)
    expect(types()).toContain('micelio:blocks')
    posted.length = 0
    patch.mockReturnValue(false)
    send(message)
    await nextTick()
    vi.advanceTimersByTime(PREVIEW_REPORT_INTERVAL_MS * 2)
    expect(types()).toEqual([])
    wrapper.unmount()
  })

  it('drops what it should not hear, and writes nothing to the console outside development', async () => {
    const wrapper = await mountSuspended(Blocks)
    posted.length = 0
    const select = { v: 1, type: 'micelio:select', payload: { address: address(1, 'feature-grid') } }
    send(select, { origin: 'https://evil.example.com' })
    send(select, { origin: 'http://cms.example.com' })
    send(select, { source: window })
    send(select, { source: null })
    send({ ...select, v: 2 })
    send({ v: 1, type: 'micelio:other', payload: {} })
    send('micelio:select')
    send({ type: 'micelio:select' })
    send({ v: 1, type: 'load-draft', payload: {} })
    expect(types()).toEqual([])
    expect(warn).not.toHaveBeenCalled()

    send({ ...select, payload: { address: address(1, 'hero') } })
    send({ ...select, payload: { address: { ...address(1, 'feature-grid'), version: 'stale' } } })
    send({ ...select, payload: { address: address(1, 'feature-grid'), item: -2 } })
    send({ v: 1, type: 'micelio:patch', payload: { address: address(0, 'hero'), content: { html: '<img src=x onerror=alert(1)>' } } })
    send({ v: 1, type: 'micelio:insertGap', payload: { version, zone: 'sections', after: 0, height: 99_999 } })
    expect(types()).toEqual([])
    expect(patch).not.toHaveBeenCalled()
    expect(document.querySelector('[data-myc-gap]')).toBeNull()
    // `import.meta.dev` is false here, as in a production build: nothing is written to the console
    expect(warn).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not touch the page when it marks no zone: a draft article', async () => {
    document.body.innerHTML = '<article></article>'
    const wrapper = await mountSuspended(Blocks)
    expect(types()).toEqual(['ready'])
    send({ v: 1, type: 'micelio:select', payload: { address: address(0, 'hero') } })
    expect(types()).toEqual(['ready'])
    expect(observers).toHaveLength(0)
    wrapper.unmount()
  })

  it('reports a scroll of the page with its new offset, no more than once an interval', async () => {
    const wrapper = await mountSuspended(Blocks)
    posted.length = 0
    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    expect(types()).toEqual(['micelio:blocks'])
    expect(last('micelio:blocks')).toMatchObject({ scroll: { x: 0, y: 240 } })
    Reflect.deleteProperty(window, 'scrollY')
    wrapper.unmount()
  })

  it('removes every listener and the observer when the page is gone, and runs nothing it had pending', async () => {
    const targets = [window, document, document.documentElement] as EventTarget[]
    const add = targets.map(target => vi.spyOn(target, 'addEventListener'))
    const remove = targets.map(target => vi.spyOn(target, 'removeEventListener'))
    const wrapper = await mountSuspended(Blocks)
    const added = add.flatMap(spy => spy.mock.calls).filter(([type]) => ['message', 'scroll', 'pointermove', 'pointerleave', 'click'].includes(type))
    // a reflow held back by the interval when the page goes away
    const callback = observers.at(-1)!.callback
    callback()
    callback()
    posted.length = 0
    wrapper.unmount()
    const removed = remove.flatMap(spy => spy.mock.calls)
    vi.advanceTimersByTime(PREVIEW_REPORT_INTERVAL_MS * 3)
    const left = types()
    for (const spy of [...add, ...remove]) spy.mockRestore()
    expect(added.map(([type]) => type).sort()).toEqual(['click', 'message', 'pointerleave', 'pointermove', 'scroll'])
    expect(disconnect).toHaveBeenCalledTimes(1)
    for (const [type, listener] of added) expect(removed.some(call => call[0] === type && call[1] === listener), String(type)).toBe(true)
    expect(left).toEqual([])
  })

  it('does not load the draft again on a load-draft after the page is gone', async () => {
    const reload = vi.fn()
    Object.defineProperty(window.location, 'reload', { value: reload, configurable: true })
    const wrapper = await mountSuspended(Blocks)
    wrapper.unmount()
    send({ v: 1, type: 'load-draft', payload: { documentId: 'doc-1', locale: 'en' } })
    expect(reload).not.toHaveBeenCalled()
  })

  it('stops reporting once the page is gone', async () => {
    const wrapper = await mountSuspended(Blocks)
    wrapper.unmount()
    posted.length = 0
    send({ v: 1, type: 'micelio:hover', payload: { address: address(0, 'hero') } })
    document.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(types()).toEqual([])
  })

  it('does not report a patch it took when the page goes before Vue has rendered it', async () => {
    const wrapper = await mountSuspended(Blocks)
    send({ v: 1, type: 'micelio:patch', payload: { address: address(0, 'hero'), content: { title: 'New' }, items: [] } })
    expect(patch).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    posted.length = 0
    await nextTick()
    vi.advanceTimersByTime(PREVIEW_REPORT_INTERVAL_MS * 3)
    expect(types()).toEqual([])
  })
})
