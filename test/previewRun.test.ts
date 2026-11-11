import { describe, expect, it, vi } from 'vitest'
import { answerRun, runnableAt } from '../app/helpers/previewRun'
import { readBlockMessage } from '../app/helpers/previewBlocks'
import { MAX_OUTPUT_BYTES } from '../app/islands/runtimes/constants'
import { WorkerPool } from '../app/islands/lib/workerRunner'
import type { WorkerLike } from '../app/islands/lib/workerRunner'
import { knownSections } from '../app/helpers/pages'
import type { PlaygroundEntry, PreviewRunOptions, PreviewRunOutcome, RunAddress, RunRequest } from '../app/interfaces/preview'
import type { RawStrapiArticle } from '../app/interfaces'
import { playgroundPositions, publicArticle } from '../server/lib/publicShapes'
import { parseDraftPage, parsePage } from '../server/schemas/page'

const VERSION = '2026-11-06T10:00:00.000Z'
const address: RunAddress = { zone: 'sections', index: 1, block: 'playground', version: VERSION }
const request: RunRequest = { requestId: 'run-1', address }
const envelope = (payload: unknown, type = 'micelio:run', v: unknown = 1): unknown => ({ v, type, payload })

const blocks = [
  { __component: 'section.rich-text', html: '<p>Hi</p>' },
  { __component: 'shared.playground', runtime: 'javascript', code: 'console.log(6 * 7)', setup: 'const hidden = 1', position: 1 },
]

/** The island's entry with a pool whose runs end as `run` says; `run` receives the block the pool was asked to run. */
function entryOf(run: (block: { runtime: string, code: string, setup: string }) => Promise<PreviewRunOutcome>): PlaygroundEntry {
  return {
    workers: () => ({
      run: ({ onStarted, ...block }) => ({
        result: (async () => {
          const outcome = await run(block)
          if (outcome.started) onStarted?.()
          return outcome
        })(),
      }),
    }),
    canRun: runtime => ['sql', 'python', 'javascript'].includes(runtime),
    disposeWorkers: () => {},
  }
}

function options(run: (block: { runtime: string, code: string, setup: string }) => Promise<PreviewRunOutcome>, load: PreviewRunOptions['load'] = () => Promise.resolve(entryOf(run))): PreviewRunOptions {
  return { zone: 'sections', blocks: () => blocks, load }
}

const done = (output: string, truncated = false): PreviewRunOutcome => ({ status: 'done', output, truncated, started: true })

describe('readBlockMessage, micelio:run', () => {
  it('reads micelio:run and drops one with a missing requestId, a malformed address or a stale version', () => {
    expect(readBlockMessage(envelope({ requestId: 'run-1', address }), VERSION)).toEqual({ kind: 'run', request })
    expect(readBlockMessage(envelope({ requestId: 'run-2', address: { ...address, zone: 'blocks' } }), VERSION)).toEqual({ kind: 'run', request: { requestId: 'run-2', address: { ...address, zone: 'blocks' } } })
    // Only a position and an id are read: a code, a language or a setup that comes along is ignored
    expect(readBlockMessage(envelope({ requestId: 'run-1', address, code: 'x', runtime: 'sql', setup: 'y' }), VERSION)).toEqual({ kind: 'run', request })

    const malformed = { kind: 'malformed' }
    expect(readBlockMessage(envelope({ address }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: '', address }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: 7, address }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: 'x'.repeat(257), address }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: 'run-1' }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: 'run-1', address: null }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: 'run-1', address: { ...address, zone: 'footer' } }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: 'run-1', address: { ...address, index: -1 } }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: 'run-1', address: { ...address, block: 'Not An Id' } }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope({ requestId: 'run-1', address: { ...address, version: 'an older save' } }), VERSION)).toEqual(malformed)
    expect(readBlockMessage(envelope('run-1'), VERSION)).toEqual(malformed)
    // Another envelope version is ignored, as for every message
    expect(readBlockMessage(envelope({ requestId: 'run-1', address }, 'micelio:run', 2), VERSION)).toBeUndefined()
  })
})

describe('runnableAt', () => {
  it('finds a playground block by zone, position and catalogue id, and only that', () => {
    expect(runnableAt(blocks, request, 'sections')).toEqual({ runtime: 'javascript', code: 'console.log(6 * 7)', setup: 'const hidden = 1' })
    expect(runnableAt(blocks, { ...request, address: { ...address, zone: 'blocks' } }, 'sections')).toBeUndefined()
    expect(runnableAt(blocks, { ...request, address: { ...address, index: 0 } }, 'sections')).toBeUndefined()
    expect(runnableAt(blocks, { ...request, address: { ...address, index: 9 } }, 'sections')).toBeUndefined()
    expect(runnableAt(blocks, { ...request, address: { ...address, block: 'rich-text' } }, 'sections')).toBeUndefined()
    expect(runnableAt(undefined, request, 'sections')).toBeUndefined()
    expect(runnableAt([blocks[0], { __component: 'shared.playground', runtime: 'javascript', position: 1 }], request, 'sections')).toBeUndefined()
    expect(runnableAt([blocks[0], { __component: 'shared.quote', runtime: 'javascript', code: 'x', position: 1 }], request, 'sections')).toBeUndefined()
  })
})

describe('answerRun', () => {
  it('answers the output of the saved block, run with its own code and setup', async () => {
    const run = vi.fn(() => Promise.resolve(done('42')))
    expect(await answerRun(request, options(run))).toEqual({ requestId: 'run-1', address, ok: true, output: '42', truncated: false })
    expect(run).toHaveBeenCalledWith({ runtime: 'javascript', code: 'console.log(6 * 7)', setup: 'const hidden = 1' })
  })

  it('cuts the output at 64 KB of UTF-8 and answers truncated', async () => {
    // The reader's own pool of Workers, with a Worker that answers 140 000 bytes: two bytes each, so the cut falls on a character
    const output = 'é'.repeat(70_000)
    function worker(): WorkerLike {
      const fake: WorkerLike = {
        postMessage: (message) => {
          queueMicrotask(() => {
            fake.onmessage?.({ data: { type: 'started', id: message.id } } as MessageEvent)
            fake.onmessage?.({ data: { type: 'done', id: message.id, output, truncated: false } } as MessageEvent)
          })
        },
        terminate: () => {},
        onmessage: null,
        onerror: null,
        onmessageerror: null,
      }
      return fake
    }
    const pool = new WorkerPool(worker)
    const entry: PlaygroundEntry = { workers: () => pool, canRun: () => true, disposeWorkers: () => pool.dispose() }
    const answer = await answerRun(request, { zone: 'sections', blocks: () => blocks, load: () => Promise.resolve(entry) })
    expect(answer).toMatchObject({ ok: true, truncated: true })
    const text = (answer as { output: string }).output
    expect(new TextEncoder().encode(text).length).toBe(MAX_OUTPUT_BYTES)
    expect(text).toBe('é'.repeat(MAX_OUTPUT_BYTES / 2))
    // A Worker that already cut the output keeps saying so
    expect(await answerRun(request, options(() => Promise.resolve(done('short', true))))).toMatchObject({ output: 'short', truncated: true })
  })

  it('answers runtimeUnavailable when the runtime does not load, and tries again on the next run', async () => {
    const load = vi.fn<PreviewRunOptions['load']>()
      .mockRejectedValueOnce(new Error('Failed to fetch https://example.test/secret/path.js'))
      .mockResolvedValue(entryOf(() => Promise.resolve(done('42'))))
    const opts = options(() => Promise.resolve(done('42')), load)
    expect(await answerRun(request, opts)).toEqual({ requestId: 'run-1', address, ok: false, reason: 'runtimeUnavailable' })
    expect(await answerRun({ ...request, requestId: 'run-2' }, opts)).toEqual({ requestId: 'run-2', address, ok: true, output: '42', truncated: false })
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('answers runtimeUnavailable for a Worker that fails before its runtime has loaded', async () => {
    expect(await answerRun(request, options(() => Promise.resolve({ status: 'error', output: 'at https://x.test/runtimes/a.js:1', truncated: false, started: false }))))
      .toEqual({ requestId: 'run-1', address, ok: false, reason: 'runtimeUnavailable' })
    expect(await answerRun(request, options(() => Promise.reject(new Error('boom'))))).toMatchObject({ ok: false, reason: 'runtimeUnavailable' })
  })

  it('answers codeError with the message, and timeout with none', async () => {
    expect(await answerRun(request, options(() => Promise.resolve({ status: 'error', output: 'ReferenceError: nope is not defined', truncated: false, started: true }))))
      .toEqual({ requestId: 'run-1', address, ok: false, reason: 'codeError', output: 'ReferenceError: nope is not defined' })
    expect(await answerRun(request, options(() => Promise.resolve({ status: 'timeout', output: '', truncated: false, started: true }))))
      .toEqual({ requestId: 'run-1', address, ok: false, reason: 'timeout' })
  })

  it('answers notRunnable for an address with no playground block, and runs nothing', async () => {
    const run = vi.fn(() => Promise.resolve(done('')))
    const load = vi.fn(() => Promise.resolve(entryOf(run)))
    expect(await answerRun({ ...request, address: { ...address, index: 0, block: 'rich-text' } }, options(run, load))).toEqual({ requestId: 'run-1', address: { ...address, index: 0, block: 'rich-text' }, ok: false, reason: 'notRunnable' })
    expect(load).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('answers notRunnable for a language the playground has no runtime for, and runs nothing', async () => {
    const run = vi.fn(() => Promise.resolve(done('')))
    const ruby = [blocks[0], { __component: 'shared.playground', runtime: 'ruby', code: 'puts 1', position: 1 }]
    expect(await answerRun(request, { ...options(run), blocks: () => ruby })).toEqual({ requestId: 'run-1', address, ok: false, reason: 'notRunnable' })
    expect(run).not.toHaveBeenCalled()
  })

  it('sends no answer for a run that was stopped', async () => {
    expect(await answerRun(request, options(() => Promise.resolve({ status: 'stopped', output: '', truncated: false, started: false })))).toBeNull()
  })
})

describe('a page draft with a Playground block', () => {
  const context = { render: (markdown: string): string => `<p>${markdown}</p>`, siteUrl: 'https://bogdev.test/', mediaOrigins: [] }
  const raw = {
    documentId: 'doc-1',
    title: 'Islands',
    slug: 'islands',
    sections: [
      { __component: 'section.rich-text', body: 'Two islands' },
      { __component: 'shared.playground', runtime: 'python', code: 'print(1)', setup: null, expectedOutput: '1', caption: 'x' },
      { __component: 'shared.playground', runtime: 'python', code: '' },
    ],
  }

  it('keeps the block with its language, code and setup only, and the public page still drops it', () => {
    expect(parseDraftPage(raw, context)?.sections).toEqual([
      { __component: 'section.rich-text', html: '<p>Two islands</p>' },
      { __component: 'shared.playground', runtime: 'python', code: 'print(1)', position: 1 },
    ])
    expect(parsePage(raw, context)?.sections).toEqual([{ __component: 'section.rich-text', html: '<p>Two islands</p>' }])
  })

  it('keeps the CMS position of each block when a section before it is invalid or unknown, and runs the right one', async () => {
    const shifted = {
      ...raw,
      sections: [
        { __component: 'section.rich-text', body: 'Kept' },
        { __component: 'section.rich-text' },
        { __component: 'section.unknown-yet' },
        { __component: 'shared.playground', runtime: 'javascript', code: 'console.log("first")' },
        { __component: 'shared.playground', runtime: 'javascript', code: 'console.log("second")' },
      ],
    }
    const sections = parseDraftPage(shifted, context)?.sections
    expect(sections).toHaveLength(3)
    const run = vi.fn((block: { code: string }) => Promise.resolve(done(block.code)))
    const second = { ...request, address: { ...address, index: 4 } }
    expect(await answerRun(second, { ...options(run), blocks: () => sections })).toMatchObject({ ok: true, output: 'console.log("second")' })
    // The index of a section that was dropped, or of the array offset the block ended at, names nothing
    expect(await answerRun({ ...request, address: { ...address, index: 2 } }, { ...options(run), blocks: () => sections })).toMatchObject({ ok: false, reason: 'notRunnable' })
  })

  it('is not a section the page renders', () => {
    expect(knownSections(parseDraftPage(raw, context)?.sections)).toHaveLength(1)
  })
})

describe('an article draft with a block dropped before a Playground block', () => {
  it('gives the CMS position of the Playground blocks beside the article, and the public article never carries it', async () => {
    const cms = [
      { id: 1, __component: 'shared.quote', body: 'q' },
      { id: 2, __component: 'shared.unknown-yet' },
      { id: 3, __component: 'shared.playground', runtime: 'javascript', code: 'console.log("first")' },
      { id: 4, __component: 'shared.playground', runtime: 'javascript', code: 'console.log("second")' },
    ] as unknown as RawStrapiArticle['blocks']
    const kept = publicArticle({ id: 1, blocks: cms } as RawStrapiArticle).blocks
    expect(kept).toHaveLength(3)
    expect(playgroundPositions(cms)).toEqual([2, 3])
    const run = vi.fn((block: { code: string }) => Promise.resolve(done(block.code)))
    const third = { ...request, address: { ...address, zone: 'blocks' as const, index: 3 } }
    expect(await answerRun(third, { ...options(run), zone: 'blocks', blocks: () => kept, positions: () => playgroundPositions(cms) })).toMatchObject({ ok: true, output: 'console.log("second")' })
    expect(kept?.some(block => 'position' in block)).toBe(false)
  })
})
