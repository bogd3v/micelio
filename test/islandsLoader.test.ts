// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ missing: [] as string[], saveData: false, entryLoads: 0, visibleLoads: 0 }))

vi.mock('../app/islands/lib/features', () => ({
  missingFeatures: () => state.missing,
  saveData: () => state.saveData,
}))
vi.mock('../app/islands/lib/hydrated', () => ({ whenHydrated: () => Promise.resolve() }))
vi.mock('/_islands/play-1.js', () => {
  state.entryLoads++
  return {}
})

vi.mock('/_islands/play-2.js', () => {
  state.visibleLoads++
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

beforeEach(() => {
  state.missing = []
  state.saveData = false
  state.entryLoads = 0
  state.visibleLoads = 0
  vi.resetModules()
})

afterEach(() => {
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
})
