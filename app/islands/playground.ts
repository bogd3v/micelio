// <micelio-playground> (ADR 0006, section 6): the part of the playground that loads when Run is pressed. `loader.ts` shows the Run
// button and imports this module on its first press; defining the element upgrades the markup of PlaygroundBlock: it starts the
// Worker (ADR 0004, worker containment), writes the output and handles Stop. Strings come from the server in data attributes.
// The output is always written with textContent. It shares no module with the loader.
import { fillLabel, formatDownload, MAX_OUTPUT_BYTES, RUN_TIMEOUT_MS } from '../helpers/playgroundRunner'
import type { RunResult } from '../helpers/playgroundRunner'
import { WorkerPool } from './lib/workerRunner'
import type { RunHandle } from './lib/workerRunner'

// One pool for the page: a runtime downloads once however many playgrounds use it
let pool: WorkerPool | undefined

function workers(): WorkerPool {
  pool ??= new WorkerPool(runtime => new Worker(new URL('./workers/playground.ts', import.meta.url), { type: 'module', name: `micelio-${runtime}` }))
  return pool
}

type State = 'queued' | 'loading' | 'running' | 'done' | 'error' | 'stopped'

class MicelioPlayground extends HTMLElement {
  private run!: HTMLButtonElement
  private stop!: HTMLButtonElement
  private result!: HTMLElement
  private code!: HTMLElement
  private figure!: HTMLElement
  private status!: HTMLElement
  private current: RunHandle | undefined
  private bound = false

  connectedCallback(): void {
    // The element can be moved: its controls are already listening
    if (this.bound) return
    const run = this.querySelector<HTMLButtonElement>('[data-playground-run]')
    const stop = this.querySelector<HTMLButtonElement>('[data-playground-stop]')
    const result = this.querySelector<HTMLElement>('[data-playground-result]')
    const code = this.querySelector<HTMLElement>('[data-playground-code]')
    const figure = this.querySelector<HTMLElement>('[data-runtime]')
    if (!run || !stop || !result || !code || !figure?.dataset.runtime) return
    Object.assign(this, { run, stop, result, code, figure })
    this.status = this.querySelector<HTMLElement>('[data-playground-status]') ?? result
    this.bound = true
    run.addEventListener('click', () => this.start())
    stop.addEventListener('click', () => this.current?.cancel())
  }

  disconnectedCallback(): void {
    this.current?.cancel()
    // Once the last playground has left the page (a client-side navigation), an idle Worker is no use
    setTimeout(() => {
      if (!document.querySelector('micelio-playground')) pool?.dispose()
    }, 0)
  }

  private label(name: string): string {
    return this.dataset[name] ?? ''
  }

  // The output is not a live region (it can be 64 KB): a short status in a region of its own is what a screen reader announces
  private show(state: State, text: string, status: string = text): void {
    this.result.dataset.state = state
    this.result.textContent = text
    this.status.textContent = status
  }

  private busy(busy: boolean): void {
    // aria-disabled, not disabled: the button keeps the focus the reader gave it
    this.run.setAttribute('aria-disabled', String(busy))
    // Hiding the button that has the focus would drop it on the page: it goes back to Run
    if (!busy && document.activeElement === this.stop) this.run.focus()
    this.stop.hidden = !busy
    this.result.setAttribute('aria-busy', String(busy))
  }

  private start(): void {
    if (this.current) return
    this.busy(true)
    this.show('loading', this.label('loading'))
    const handle = workers().run({
      runtime: this.figure.dataset.runtime ?? '',
      code: this.code.textContent ?? '',
      setup: this.figure.dataset.playgroundSetup ?? '',
      onQueued: () => this.show('queued', this.label('queued')),
      onBegin: () => this.show('loading', this.label('loading')),
      onStarted: () => this.show('running', this.label('running')),
    })
    this.current = handle
    void this.finish(handle)
  }

  private async finish(handle: RunHandle): Promise<void> {
    try {
      const outcome = await handle.result
      if (this.current !== handle) return
      this.current = undefined
      this.busy(false)
      this.render(outcome)
    } catch {
      this.current = undefined
      this.busy(false)
      this.show('error', this.label('unavailable'))
    }
  }

  private render(outcome: RunResult): void {
    const seconds = String(RUN_TIMEOUT_MS / 1000)
    if (outcome.status === 'timeout') return this.show('error', fillLabel(this.label('timeout'), { seconds }))
    if (outcome.status === 'stopped') return this.show('stopped', this.label('stopped'))
    if (outcome.status === 'error') return this.show('error', outcome.output ? fillLabel(this.label('error'), { message: outcome.output }) : this.label('unavailable'))
    const note = outcome.truncated ? `\n${fillLabel(this.label('truncated'), { size: formatDownload(MAX_OUTPUT_BYTES / 1024) })}` : ''
    const lines = outcome.output ? outcome.output.split('\n').length : 0
    this.show('done', outcome.output || outcome.truncated ? `${outcome.output}${note}` : this.label('empty'), lines ? fillLabel(this.label('statusDone'), { lines: String(lines) }) : this.label('empty'))
  }
}

if (!customElements.get('micelio-playground')) customElements.define('micelio-playground', MicelioPlayground)
