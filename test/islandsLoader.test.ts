// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ missing: [] as string[], saveData: false, reduced: false, entryLoads: 0, visibleLoads: 0, twoLoads: 0, rescanLoads: 0, hydration: Promise.resolve() as Promise<void>, raceLoads: 0, motionLoads: 0 }))

vi.mock('../app/islands/lib/features', () => ({
  missingFeatures: () => state.missing,
  saveData: () => state.saveData,
  prefersReducedMotion: () => state.reduced,
}))
vi.mock('../app/islands/lib/hydrated', () => ({ whenHydrated: () => state.hydration }))
vi.mock('/_islands/play-1.js', () => {
  state.entryLoads++
  return {}
})

vi.mock('/_islands/play-2.js', () => {
  state.visibleLoads++
  return {}
})

vi.mock('/_islands/play-3.js', () => {
  state.twoLoads++
  return {}
})
vi.mock('/_islands/play-4.js', () => {
  state.rescanLoads++
  return {}
})

vi.mock('/_islands/play-5.js', () => {
  state.raceLoads++
  return {}
})

vi.mock('/_islands/play-6.js', () => {
  state.motionLoads++
  return {}
})

const SRC = '/_islands/play-1.js'

function declare(extra: object = {}): void {
  document.body.innerHTML = `
    <script type="application/json" id="micelio-island-play">${JSON.stringify({ id: 'play', trigger: 'interaction', saveData: 'skip', src: SRC, control: '[data-play-run]', features: ['worker'], ...extra })}</script>
    <micelio-play data-save-data-label="Run (2 MB)" data-save-data-aria="Run, downloads 2 MB">
      <button type="button" data-play-run hidden aria-label="Run the code">Run</button>
    </micelio-play>`
}

async function start(): Promise<HTMLButtonElement> {
  vi.resetModules()
  await import('../app/islands/loader')
  await vi.waitFor(() => expect(document.querySelector<HTMLButtonElement>('[data-play-run]')).not.toBeNull())
  return document.querySelector<HTMLButtonElement>('[data-play-run]')!
}

// Each import of the loader adds a scan listener to the document: drop them, or an earlier test's loader would answer this one's events
const scanListeners: EventListener[] = []
const addListener = document.addEventListener.bind(document)

beforeEach(() => {
  vi.spyOn(document, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    if (type === 'micelio:heavy-scan') scanListeners.push(listener as EventListener)
    addListener(type, listener, options)
  })
  state.missing = []
  state.saveData = false
  state.reduced = false
  state.entryLoads = 0
  state.visibleLoads = 0
  state.twoLoads = 0
  state.rescanLoads = 0
  state.raceLoads = 0
  state.motionLoads = 0
  state.hydration = Promise.resolve()
  vi.resetModules()
})

afterEach(() => {
  for (const listener of scanListeners.splice(0)) document.removeEventListener('micelio:heavy-scan', listener)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('loader, interaction islands', () => {
  it('shows the control after hydration and loads nothing until it is pressed', async () => {
    declare()
    const control = await start()
    await vi.waitFor(() => expect(control.hidden).toBe(false))
    expect(state.entryLoads).toBe(0)
  })

  it('keeps the control hidden without the island\'s features', async () => {
    state.missing = ['worker']
    declare()
    const control = await start()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(control.hidden).toBe(true)
  })

  it('imports the entry on the first press and presses the control again once it is defined', async () => {
    declare()
    const control = await start()
    await vi.waitFor(() => expect(control.hidden).toBe(false))
    const clicks: number[] = []
    control.addEventListener('click', () => clicks.push(state.entryLoads))
    control.click()
    await vi.waitFor(() => expect(clicks).toHaveLength(2))
    // The press itself, then the replay after the import
    expect(clicks).toEqual([0, 1])
  })

  it('tells the reader what the press costs under Save-Data, and still allows it', async () => {
    state.saveData = true
    declare()
    const control = await start()
    await vi.waitFor(() => expect(control.hidden).toBe(false))
    expect(control.textContent).toBe('Run (2 MB)')
    expect(control.getAttribute('aria-label')).toBe('Run, downloads 2 MB')
  })

  it('marks the element when the import fails, so the island can say it is unavailable', async () => {
    declare({ src: '/_islands/missing-1.js' })
    const control = await start()
    await vi.waitFor(() => expect(control.hidden).toBe(false))
    control.click()
    await vi.waitFor(() => expect(document.querySelector('micelio-play')!.hasAttribute('data-island-error')).toBe(true))
    // The press can be repeated: the loader waits for the next one
    expect(control.hidden).toBe(false)
    // The next press tries again (the entry is still missing, so it fails again, and the loader still listens)
    document.querySelector('micelio-play')!.removeAttribute('data-island-error')
    control.click()
    await vi.waitFor(() => expect(document.querySelector('micelio-play')!.hasAttribute('data-island-error')).toBe(true))
  })

  it('does not repeat a press when another element of the island imported the entry first', async () => {
    declare({ src: '/_islands/play-3.js' })
    document.body.insertAdjacentHTML('beforeend', '<micelio-play><button type="button" data-play-run hidden>Run</button></micelio-play>')
    await start()
    const [first, second] = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-play-run]'))
    await vi.waitFor(() => expect(first!.hidden).toBe(false))
    await vi.waitFor(() => expect(second!.hidden).toBe(false))
    const secondClicks: number[] = []
    second!.addEventListener('click', () => secondClicks.push(state.twoLoads))
    first!.click()
    await vi.waitFor(() => expect(state.twoLoads).toBe(1))
    // A real press on the second control reaches the entry once; the loader does not replay it
    second!.click()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(secondClicks).toHaveLength(1)
  })

  it('stops waiting on a control when a newer scan replaces the wait, and arms it again', async () => {
    declare({ src: '/_islands/play-4.js' })
    const control = await start()
    await vi.waitFor(() => expect(control.hidden).toBe(false))
    const removed = vi.spyOn(control, 'removeEventListener')
    document.dispatchEvent(new Event('micelio:heavy-scan'))
    await vi.waitFor(() => expect(removed).toHaveBeenCalledWith('click', expect.any(Function)))
    // Armed again by the new scan: a press still loads the entry
    await new Promise(resolve => setTimeout(resolve, 20))
    control.click()
    await vi.waitFor(() => expect(state.rescanLoads).toBe(1))
  })

  it('arms the control when a second scan comes while the page is still hydrating', async () => {
    // useHeavyIsland dispatches a scan on mount, which can come before hydration has finished
    let hydrated!: () => void
    state.hydration = new Promise<void>((resolve) => {
      hydrated = resolve
    })
    declare({ src: '/_islands/play-5.js' })
    const control = await start()
    document.dispatchEvent(new Event('micelio:heavy-scan'))
    hydrated()
    await vi.waitFor(() => expect(control.hidden).toBe(false))
    control.click()
    await vi.waitFor(() => expect(state.raceLoads).toBe(1))
  })

  it('ignores a declaration whose control is not a data attribute selector', async () => {
    declare({ control: 'button.evil' })
    await start()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(document.querySelector<HTMLButtonElement>('[data-play-run]')!.hidden).toBe(true)
  })
})

describe('loader, visible islands', () => {
  function declareVisible(extra: object): void {
    document.body.innerHTML = `
      <script type="application/json" id="micelio-island-play">${JSON.stringify({ id: 'play', trigger: 'visible', saveData: 'skip', src: SRC, features: [], ...extra })}</script>
      <micelio-play></micelio-play>`
  }

  it('stays on the fallback under Save-Data unless the island loads anyway', async () => {
    // Without an observer the element counts as visible
    vi.stubGlobal('IntersectionObserver', undefined)
    vi.stubGlobal('requestIdleCallback', undefined)
    state.saveData = true
    declareVisible({ src: '/_islands/play-2.js' })
    vi.resetModules()
    await import('../app/islands/loader')
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(state.visibleLoads).toBe(0)

    declareVisible({ src: '/_islands/play-2.js', saveData: 'load' })
    vi.resetModules()
    await import('../app/islands/loader')
    await vi.waitFor(() => expect(state.visibleLoads).toBe(1), { timeout: 3000 })
  })

  it('keeps an island that animates on its fallback under reduced motion, and loads one that does not', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    vi.stubGlobal('requestIdleCallback', undefined)
    state.reduced = true
    declareVisible({ src: '/_islands/play-6.js', motion: true })
    vi.resetModules()
    await import('../app/islands/loader')
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(state.motionLoads).toBe(0)

    declareVisible({ src: '/_islands/play-6.js' })
    vi.resetModules()
    await import('../app/islands/loader')
    await vi.waitFor(() => expect(state.motionLoads).toBe(1), { timeout: 3000 })
  })

  it('leaves the control of an interaction island hidden under reduced motion', async () => {
    state.reduced = true
    declare({ motion: true })
    vi.resetModules()
    await import('../app/islands/loader')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(document.querySelector<HTMLButtonElement>('[data-play-run]')!.hidden).toBe(true)
  })
})
