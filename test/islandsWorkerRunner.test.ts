import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerReply, WorkerRequest } from '../app/helpers/playgroundRunner'
import { WorkerPool } from '../app/islands/lib/workerRunner'
import type { WorkerLike } from '../app/islands/lib/workerRunner'

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  terminated = false
  requests: WorkerRequest[] = []

  postMessage(message: WorkerRequest): void {
    this.requests.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  reply(message: WorkerReply): void {
    this.onmessage?.({ data: message } as MessageEvent)
  }

  last(): WorkerRequest {
    return this.requests.at(-1)!
  }
}

const RUN = { runtime: 'sql', code: 'SELECT 1', setup: '' }

describe('WorkerPool', () => {
  let workers: FakeWorker[]
  let pool: WorkerPool

  beforeEach(() => {
    vi.useFakeTimers()
    workers = []
    pool = new WorkerPool(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    }, { runMs: 5000, loadMs: 60000 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the code in a Worker and returns its output', async () => {
    const { result } = pool.run({ ...RUN, setup: 'CREATE TABLE t(a)' })
    await vi.advanceTimersByTimeAsync(0)
    expect(workers).toHaveLength(1)
    expect(workers[0]!.last()).toMatchObject({ type: 'run', runtime: 'sql', code: 'SELECT 1', setup: 'CREATE TABLE t(a)' })
    workers[0]!.reply({ type: 'started', id: workers[0]!.last().id })
    workers[0]!.reply({ type: 'done', id: workers[0]!.last().id, output: 'one\n---\n1', truncated: false })
    expect(await result).toEqual({ status: 'done', output: 'one\n---\n1', truncated: false })
  })

  it('reports a runtime error and keeps the Worker for the next run', async () => {
    const first = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    workers[0]!.reply({ type: 'error', id: workers[0]!.last().id, message: 'no such table: t' })
    expect(await first.result).toEqual({ status: 'error', output: 'no such table: t', truncated: false })
    expect(workers[0]!.terminated).toBe(false)

    const second = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    expect(workers).toHaveLength(1)
    workers[0]!.reply({ type: 'done', id: workers[0]!.last().id, output: 'ok', truncated: false })
    expect((await second.result).status).toBe('done')
  })

  it('stops a run that lasts longer than the limit, terminates the Worker and starts a new one next time', async () => {
    const first = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    workers[0]!.reply({ type: 'started', id: workers[0]!.last().id })
    await vi.advanceTimersByTimeAsync(4999)
    expect(workers[0]!.terminated).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await first.result).toEqual({ status: 'timeout', output: '', truncated: false })
    expect(workers[0]!.terminated).toBe(true)

    const second = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    expect(workers).toHaveLength(2)
    workers[1]!.reply({ type: 'done', id: workers[1]!.last().id, output: 'ok', truncated: false })
    expect((await second.result).status).toBe('done')
  })

  it('does not count the time the runtime takes to load against the limit', async () => {
    const run = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(30000)
    expect(workers[0]!.terminated).toBe(false)
    workers[0]!.reply({ type: 'started', id: workers[0]!.last().id })
    await vi.advanceTimersByTimeAsync(4000)
    workers[0]!.reply({ type: 'done', id: workers[0]!.last().id, output: 'slow but fine', truncated: false })
    expect((await run.result).status).toBe('done')
  })

  it('gives up on a runtime that never loads', async () => {
    const run = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(60000)
    expect(await run.result).toEqual({ status: 'error', output: '', truncated: false })
    expect(workers[0]!.terminated).toBe(true)
  })

  it('cancels a running run: stopped, Worker terminated, no late result', async () => {
    const run = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    workers[0]!.reply({ type: 'started', id: workers[0]!.last().id })
    const late = workers[0]!.onmessage
    run.cancel()
    expect(await run.result).toEqual({ status: 'stopped', output: '', truncated: false })
    expect(workers[0]!.terminated).toBe(true)
    expect(workers[0]!.onmessage).toBeNull()
    expect(late).not.toBeNull()
  })

  it('removes a queued run from the queue without running it', async () => {
    const first = pool.run(RUN)
    const second = pool.run({ ...RUN, code: 'SELECT 2' })
    await vi.advanceTimersByTimeAsync(0)
    // It answers at once, while the first run is still going
    second.cancel()
    expect(await second.result).toEqual({ status: 'stopped', output: '', truncated: false })
    expect(workers[0]!.terminated).toBe(false)
    workers[0]!.reply({ type: 'done', id: workers[0]!.last().id, output: 'one', truncated: false })
    expect((await first.result).output).toBe('one')
    expect(workers[0]!.requests).toHaveLength(1)
  })

  it('runs the playgrounds of a page one after the other in the same Worker', async () => {
    const first = pool.run(RUN)
    const second = pool.run({ ...RUN, code: 'SELECT 2' })
    await vi.advanceTimersByTimeAsync(0)
    expect(workers).toHaveLength(1)
    expect(workers[0]!.requests).toHaveLength(1)
    workers[0]!.reply({ type: 'done', id: workers[0]!.last().id, output: 'one', truncated: false })
    await first.result
    await vi.advanceTimersByTimeAsync(0)
    expect(workers[0]!.requests).toHaveLength(2)
    expect(workers[0]!.last().code).toBe('SELECT 2')
    workers[0]!.reply({ type: 'done', id: workers[0]!.last().id, output: 'two', truncated: false })
    expect((await second.result).output).toBe('two')
  })

  it('keeps one Worker per runtime', async () => {
    pool.run(RUN)
    pool.run({ ...RUN, runtime: 'python' })
    await vi.advanceTimersByTimeAsync(0)
    expect(workers).toHaveLength(2)
  })

  it('ignores replies for another run and messages that are not replies', async () => {
    const run = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    const id = workers[0]!.last().id
    workers[0]!.reply({ type: 'done', id: id + 1, output: 'not mine', truncated: false })
    workers[0]!.onmessage?.({ data: 'junk' } as MessageEvent)
    workers[0]!.onmessage?.({ data: { type: 'done', id, output: 3 } } as MessageEvent)
    workers[0]!.reply({ type: 'done', id, output: 'mine', truncated: false })
    expect((await run.result).output).toBe('mine')
  })

  it('caps an output a Worker sends over the limit anyway', async () => {
    const run = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    workers[0]!.reply({ type: 'done', id: workers[0]!.last().id, output: 'x'.repeat(70000), truncated: false })
    const result = await run.result
    expect(result.output).toHaveLength(65536)
    expect(result.truncated).toBe(true)
  })

  it('reports a crashed Worker and does not reuse it', async () => {
    const run = pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    workers[0]!.onerror?.({} as ErrorEvent)
    expect(await run.result).toEqual({ status: 'error', output: '', truncated: false })
    expect(workers[0]!.terminated).toBe(true)
    pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    expect(workers).toHaveLength(2)
  })

  it('reports a Worker that cannot be created', async () => {
    const broken = new WorkerPool(() => {
      throw new Error('blocked')
    })
    expect(await broken.run(RUN).result).toEqual({ status: 'error', output: '', truncated: false })
  })

  it('terminates every Worker on dispose', async () => {
    pool.run(RUN)
    await vi.advanceTimersByTimeAsync(0)
    pool.dispose()
    expect(workers[0]!.terminated).toBe(true)
  })

  it('tells the caller when the clock of the run starts', async () => {
    const onStarted = vi.fn()
    const run = pool.run({ ...RUN, onStarted })
    await vi.advanceTimersByTimeAsync(0)
    expect(onStarted).not.toHaveBeenCalled()
    workers[0]!.reply({ type: 'started', id: workers[0]!.last().id })
    expect(onStarted).toHaveBeenCalledTimes(1)
    workers[0]!.reply({ type: 'done', id: workers[0]!.last().id, output: '', truncated: false })
    await run.result
  })
})
