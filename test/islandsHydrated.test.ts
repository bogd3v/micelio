// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HYDRATED_EVENT, HYDRATED_FLAG, whenHydrated } from '../app/islands/lib/hydrated'
import { missingFeatures, prefersReducedMotion, resetFeatureCache, saveData, supportsWasm, supportsWebGL2, supportsWorker } from '../app/islands/lib/features'

function failing(): never {
  throw new Error('blocked')
}

function nuxtPage(): void {
  document.body.innerHTML = '<script id="__NUXT_DATA__" type="application/json">[]</script>'
}

afterEach(() => {
  document.body.innerHTML = ''
  Reflect.deleteProperty(window, HYDRATED_FLAG)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetFeatureCache()
})

describe('whenHydrated', () => {
  it('resolves at once without a Nuxt app', async () => {
    await expect(whenHydrated()).resolves.toBeUndefined()
  })

  it('resolves at once when hydration already finished', async () => {
    nuxtPage()
    Object.assign(window, { [HYDRATED_FLAG]: true })
    await expect(whenHydrated()).resolves.toBeUndefined()
  })

  it('waits for the event on a Nuxt page', async () => {
    nuxtPage()
    let resolved = false
    const promise = whenHydrated().then(() => (resolved = true))
    await Promise.resolve()
    expect(resolved).toBe(false)
    document.dispatchEvent(new Event(HYDRATED_EVENT))
    await promise
    expect(resolved).toBe(true)
  })

  it('gives up after the timeout', async () => {
    vi.useFakeTimers()
    nuxtPage()
    const promise = whenHydrated(1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(promise).resolves.toBeUndefined()
  })
})

describe('features', () => {
  it('detects WebAssembly and workers from the globals', () => {
    expect(supportsWasm()).toBe(true)
    vi.stubGlobal('WebAssembly', undefined)
    expect(supportsWasm()).toBe(false)
    vi.stubGlobal('Worker', undefined)
    expect(supportsWorker()).toBe(false)
    vi.stubGlobal('Worker', function Worker() {})
    expect(supportsWorker()).toBe(true)
  })

  it('detects WebGL2 once and releases the context', () => {
    const loseContext = vi.fn()
    const getContext = vi.fn(() => ({ getExtension: () => ({ loseContext }) }))
    vi.spyOn(document, 'createElement').mockReturnValue({ getContext } as unknown as HTMLCanvasElement)
    expect(supportsWebGL2()).toBe(true)
    expect(supportsWebGL2()).toBe(true)
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(loseContext).toHaveBeenCalled()
  })

  it('reports no WebGL2 when the context is null or throws', () => {
    vi.spyOn(document, 'createElement').mockReturnValue({ getContext: () => null } as unknown as HTMLCanvasElement)
    expect(supportsWebGL2()).toBe(false)
    resetFeatureCache()
    vi.spyOn(document, 'createElement').mockReturnValue({ getContext: () => failing() } as unknown as HTMLCanvasElement)
    expect(supportsWebGL2()).toBe(false)
  })

  it('lists the required features that are missing', () => {
    vi.stubGlobal('Worker', undefined)
    vi.spyOn(document, 'createElement').mockReturnValue({ getContext: () => null } as unknown as HTMLCanvasElement)
    expect(missingFeatures(['wasm', 'worker', 'webgl2'])).toEqual(['worker', 'webgl2'])
    expect(missingFeatures([])).toEqual([])
  })

  it('reads prefers-reduced-motion and Save-Data', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    expect(prefersReducedMotion()).toBe(true)
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
    expect(saveData()).toBe(false)
    vi.stubGlobal('navigator', { connection: { saveData: true } })
    expect(saveData()).toBe(true)
  })
})
