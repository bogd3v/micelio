import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startPreviewBridge } from '~/helpers/previewBridge'
import type { PlaygroundEntry, PreviewFrame, PreviewRunOptions, PreviewRunOutcome } from '~/interfaces'

const ADMIN = 'https://cms.example.com'
const frame: PreviewFrame = { adminOrigin: ADMIN, documentId: 'doc-1', locale: 'en', version: '2026-10-24T09:30:00.000Z' }
const address = { zone: 'blocks', index: 1, block: 'playground', version: frame.version }
const run = { v: 1, type: 'micelio:run', payload: { requestId: 'run-1', address } }
const blocks = [{ __component: 'shared.rich-text' }, { __component: 'shared.playground', runtime: 'javascript', code: 'console.log(1)', position: 1 }]

// The bridge starts the conversation of a draft page with the admin that frames it; here the frame is a window whose parent is a recorder
describe('the bridge and micelio:run', () => {
  const posted: Array<{ message: { type: string, payload: Record<string, unknown> }, origin: string }> = []
  const parent = { postMessage: (message: never, origin: string): number => posted.push({ message, origin }) } as unknown as Window
  let original: PropertyDescriptor | undefined
  let ends: Array<() => void> = []

  beforeEach(() => {
    posted.length = 0
    original = Object.getOwnPropertyDescriptor(window, 'parent')
    Object.defineProperty(window, 'parent', { value: parent, configurable: true })
  })

  afterEach(() => {
    for (const end of ends) end()
    ends = []
    if (original) Object.defineProperty(window, 'parent', original)
    else Reflect.deleteProperty(window, 'parent')
  })

  function send(data: unknown, init: { origin?: string, source?: unknown } = {}): void {
    window.dispatchEvent(new MessageEvent('message', { data, origin: init.origin ?? ADMIN, source: ('source' in init ? init.source : parent) as MessageEventSource }))
  }

  const answers = (): typeof posted => posted.filter(entry => entry.message.type === 'micelio:runResult')

  async function start(driver: () => Promise<PreviewRunOutcome>, extra: Partial<PreviewRunOptions> = {}): Promise<() => void> {
    const entry: PlaygroundEntry = {
      workers: () => ({
        run: ({ onStarted }) => ({
          result: (async () => {
            const outcome = await driver()
            onStarted?.()
            return outcome
          })(),
        }),
      }),
      canRun: () => true,
      disposeWorkers: () => {},
    }
    const end = await startPreviewBridge(frame, { run: { zone: 'blocks', blocks: () => blocks, load: () => Promise.resolve(entry), ...extra } })
    ends.push(end)
    return end
  }

  it('answers the admin origin, and only it, with the request\'s id and address', async () => {
    await start(() => Promise.resolve({ status: 'done', output: '1', truncated: false, started: true }))
    send(run)
    await vi.waitFor(() => expect(answers()).toHaveLength(1))
    expect(answers()[0]).toEqual({ origin: ADMIN, message: { v: 1, type: 'micelio:runResult', payload: { requestId: 'run-1', address, ok: true, output: '1', truncated: false } } })
  })

  it('drops a run from another origin or another window, with no answer', async () => {
    const driver = vi.fn(() => Promise.resolve({ status: 'done' as const, output: '1', truncated: false, started: true }))
    await start(driver)
    send(run, { origin: 'https://evil.example.com' })
    send(run, { source: window })
    send({ ...run, payload: { ...run.payload, address: { ...address, version: 'an older save' } } })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(driver).not.toHaveBeenCalled()
    expect(answers()).toEqual([])
  })

  it('does not know micelio:run without the draft\'s blocks, and drops it', async () => {
    const end = await startPreviewBridge(frame, {})
    ends.push(end)
    send(run)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(answers()).toEqual([])
  })

  it('sends nothing for a run that is still going when the frame goes away', async () => {
    let finish: () => void = () => {}
    let running = false
    const end = await start(() => new Promise((resolve) => {
      running = true
      finish = () => resolve({ status: 'done', output: '1', truncated: false, started: true })
    }))
    send(run)
    await vi.waitFor(() => expect(running).toBe(true))
    end()
    finish()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(answers()).toEqual([])
  })
})
