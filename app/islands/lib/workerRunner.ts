// Runs code in dedicated Workers, one per runtime and page (ADR 0004, worker containment). A Worker stays loaded between runs, so a
// runtime downloads once for every playground of the page; a run that times out or is stopped terminates it, and the next run starts a new one.
import { LOAD_TIMEOUT_MS, RUN_TIMEOUT_MS } from '../runtimes/constants'
import type { RunResult, WorkerRequest } from '../types'
import { capOutput, isWorkerReply } from '../../helpers/playgroundRunner'

/**
 * The part of `Worker` the runner uses; tests pass a fake.
 *
 * @internal Exported for tests.
 */
export interface WorkerLike {
  postMessage: (message: WorkerRequest) => void
  terminate: () => void
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
}

interface RunOptions {
  runtime: string
  code: string
  setup: string
  /** The Worker is busy with another run: this one waits its turn. */
  onQueued?: () => void
  /** The run leaves the queue and starts loading its runtime. */
  onBegin?: () => void
  /** The runtime is loaded and the clock of the run has started. */
  onStarted?: () => void
}

/** A run started by `WorkerPool.run`: `result` settles with how the run ended, and `cancel` stops it. */
export interface RunHandle {
  result: Promise<RunResult>
  /** Stops the run (or removes it from the queue); the result is `stopped`. */
  cancel: () => void
}

interface PoolOptions {
  runMs?: number
  loadMs?: number
}

interface Slot {
  worker: WorkerLike | undefined
  tail: Promise<unknown>
  /** Runs queued or running. */
  pending: number
}

const STOPPED: RunResult = { status: 'stopped', output: '', truncated: false }

/**
 * Runs playground code in one dedicated Worker per runtime, shared by every run of that runtime on the page.
 *
 * @remarks
 * The pool runs on the main thread and only drives the Workers, which run the code (`app/islands/workers/playground.ts`). Runs of one runtime queue behind each other. The Worker is created when the first run reaches it, and a run's clock starts when the Worker reports `started`, so loading does not use up its time. A Worker is terminated when its run times out, is stopped or crashes, or when the reply sets `recycle`; the next run of that runtime starts a new one. The time limits default to `runtimes/constants.ts`. `dispose` terminates every Worker.
 */
export class WorkerPool {
  private readonly slots = new Map<string, Slot>()
  private nextId = 0
  private readonly runMs: number
  private readonly loadMs: number

  constructor(private readonly createWorker: (runtime: string) => WorkerLike, options: PoolOptions = {}) {
    this.runMs = options.runMs ?? RUN_TIMEOUT_MS
    this.loadMs = options.loadMs ?? LOAD_TIMEOUT_MS
  }

  /** Queues a run behind the ones already using the runtime's Worker. */
  run(options: RunOptions): RunHandle {
    const slot = this.slots.get(options.runtime) ?? { worker: undefined, tail: Promise.resolve(), pending: 0 }
    this.slots.set(options.runtime, slot)
    let cancelled = false
    let stopRunning: (() => void) | undefined
    let settle: (result: RunResult) => void = () => {}
    const result = new Promise<RunResult>((resolve) => {
      settle = resolve
      if (slot.pending > 0) options.onQueued?.()
      slot.pending++
      const previous = slot.tail
      slot.tail = (async () => {
        try {
          await previous
        } catch {
          // A run that failed ahead in the queue must not block the ones behind it
        }
        try {
          if (cancelled) return resolve(STOPPED)
          options.onBegin?.()
          resolve(await this.execute(slot, options, (stop) => {
            stopRunning = stop
          }))
        } finally {
          slot.pending--
        }
      })()
    })
    return {
      result,
      cancel: () => {
        cancelled = true
        // Stopping a run that waits in the queue answers at once; the queue skips it when its turn comes
        if (stopRunning) stopRunning()
        else settle(STOPPED)
      },
    }
  }

  /** Terminates every Worker (the page is going away). */
  dispose(): void {
    for (const slot of this.slots.values()) {
      slot.worker?.terminate()
      slot.worker = undefined
    }
  }

  private execute(slot: Slot, options: RunOptions, onStop: (stop: () => void) => void): Promise<RunResult> {
    const id = ++this.nextId
    return new Promise<RunResult>((resolve) => {
      let worker: WorkerLike
      try {
        worker = slot.worker ??= this.createWorker(options.runtime)
      } catch {
        resolve({ status: 'error', output: '', truncated: false })
        return
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      let settled = false
      // Reader code in the Worker can post a `started` of its own: only the first one starts the clock of the run
      let started = false

      // A Worker that is not idle (timeout, stop, crash) is killed: it may be in a loop that never ends
      function finish(status: RunResult['status'], output = '', truncated = false, keep = false): void {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.onmessage = worker.onerror = worker.onmessageerror = null
        if (!keep) {
          worker.terminate()
          if (slot.worker === worker) slot.worker = undefined
        }
        const capped = capOutput(output)
        resolve({ status, output: capped.text, truncated: truncated || capped.truncated })
      }

      onStop(() => finish('stopped'))
      timer = setTimeout(() => finish('error'), this.loadMs)
      worker.onmessage = (event) => {
        const reply = event.data
        if (!isWorkerReply(reply) || reply.id !== id) return
        if (reply.type === 'started') {
          if (started) return
          started = true
          clearTimeout(timer)
          timer = setTimeout(() => finish('timeout'), this.runMs)
          options.onStarted?.()
        } else if (reply.type === 'done') {
          finish('done', reply.output, reply.truncated, reply.recycle !== true)
        } else {
          finish('error', reply.message, false, reply.recycle !== true)
        }
      }
      worker.onerror = () => finish('error')
      worker.onmessageerror = () => finish('error')
      worker.postMessage({ type: 'run', id, runtime: options.runtime, code: options.code, setup: options.setup })
    })
  }
}
