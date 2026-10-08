// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { whenIdle, whenInteracted, whenVisible } from '../app/islands/lib/trigger'

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void

class FakeObserver {
  static instances: FakeObserver[] = []
  disconnected = false
  observed: Element[] = []
  constructor(private readonly callback: Callback, readonly options?: IntersectionObserverInit) {
    FakeObserver.instances.push(this)
  }

  observe(element: Element): void {
    this.observed.push(element)
  }

  disconnect(): void {
    this.disconnected = true
  }

  fire(isIntersecting: boolean): void {
    this.callback([{ isIntersecting }])
  }
}

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state })
}

// Fake timers are on, so "not yet" is checked after the microtasks have run
async function settled(promise: Promise<unknown>): Promise<'resolved' | 'pending'> {
  let state: 'resolved' | 'pending' = 'pending'
  promise.then(() => (state = 'resolved'), () => {})
  for (let i = 0; i < 10; i++) await Promise.resolve()
  return state
}

beforeEach(() => {
  FakeObserver.instances = []
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'readyState')
})

describe('whenIdle', () => {
  it('waits for load, then for the idle callback', async () => {
    setReadyState('loading')
    const callbacks: Array<() => void> = []
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => callbacks.push(callback))
    vi.stubGlobal('cancelIdleCallback', () => {})
    const promise = whenIdle()
    expect(callbacks).toHaveLength(0)
    setReadyState('complete')
    window.dispatchEvent(new Event('load'))
    expect(callbacks).toHaveLength(1)
    expect(await settled(promise)).toBe('pending')
    callbacks[0]!()
    await expect(promise).resolves.toBeUndefined()
  })

  it('falls back to a timeout without requestIdleCallback', async () => {
    setReadyState('complete')
    vi.stubGlobal('requestIdleCallback', undefined)
    const promise = whenIdle()
    await vi.advanceTimersByTimeAsync(200)
    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects with AbortError and stops waiting for load', async () => {
    setReadyState('loading')
    const controller = new AbortController()
    const promise = whenIdle({ signal: controller.signal })
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    await expect(whenIdle({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('whenVisible', () => {
  beforeEach(() => {
    setReadyState('complete')
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => setTimeout(callback, 0))
    vi.stubGlobal('cancelIdleCallback', (handle: number) => clearTimeout(handle))
  })

  it('needs both an intersection and the idle period', async () => {
    const element = document.createElement('div')
    const promise = whenVisible(element)
    const observer = FakeObserver.instances[0]!
    expect(observer.observed).toEqual([element])
    observer.fire(false)
    await vi.advanceTimersByTimeAsync(10)
    expect(await settled(promise)).toBe('pending')
    observer.fire(true)
    await vi.advanceTimersByTimeAsync(10)
    await expect(promise).resolves.toBeUndefined()
    expect(observer.disconnected).toBe(true)
  })

  it('disconnects the observer when aborted', async () => {
    const controller = new AbortController()
    const promise = whenVisible(document.createElement('div'), { signal: controller.signal })
    const observer = FakeObserver.instances[0]!
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(observer.disconnected).toBe(true)
  })

  it('throws AbortError at once for a signal that is already aborted', async () => {
    await expect(whenVisible(document.createElement('div'), { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeObserver.instances).toHaveLength(0)
  })

  it('uses the given root margin', () => {
    void whenVisible(document.createElement('div'), { rootMargin: '0px' }).catch(() => {})
    expect(FakeObserver.instances[0]!.options?.rootMargin).toBe('0px')
  })

  it('counts as visible where IntersectionObserver does not exist', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const promise = whenVisible(document.createElement('div'))
    await vi.advanceTimersByTimeAsync(10)
    await expect(promise).resolves.toBeUndefined()
  })
})

describe('whenInteracted', () => {
  it('resolves on the first click and removes its listeners', async () => {
    const button = document.createElement('button')
    const remove = vi.spyOn(button, 'removeEventListener')
    const promise = whenInteracted(button)
    button.click()
    await expect(promise).resolves.toBeUndefined()
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('resolves on a key that is not navigation', async () => {
    const area = document.createElement('textarea')
    const promise = whenInteracted(area)
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    for (const key of ['ArrowDown', 'PageUp', 'Home', 'End', 'F5']) area.dispatchEvent(new KeyboardEvent('keydown', { key }))
    expect(await settled(promise)).toBe('pending')
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await expect(promise).resolves.toBeUndefined()
  })

  it('listens only to the events asked for', async () => {
    const button = document.createElement('button')
    const promise = whenInteracted(button, { events: ['keydown'] })
    button.click()
    expect(await settled(promise)).toBe('pending')
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects with AbortError and ignores later events', async () => {
    const button = document.createElement('button')
    const controller = new AbortController()
    const promise = whenInteracted(button, { signal: controller.signal })
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    const remove = vi.spyOn(button, 'removeEventListener')
    button.click()
    expect(remove).not.toHaveBeenCalled()
    await expect(whenInteracted(button, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
