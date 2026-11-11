import type { PlaygroundEntry, PreviewRunOptions, PreviewRunOutcome, RunRequest, RunResultPayload, RunnableBlock } from '../interfaces/preview'

/** The catalogue id of the only block that runs (`shared.playground`, ADR 0018). */
const PLAYGROUND_COMPONENT = 'shared.playground'

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * The Playground blocks of an article draft with their place among the CMS's blocks (`position`), as `runnableAt` reads them.
 *
 * @param blocks - The draft's `article.blocks`.
 * @param positions - `playgroundPositions` of the draft response, one per Playground block in order.
 */
function withPositions(blocks: ReadonlyArray<unknown> | null | undefined, positions: ReadonlyArray<number> | undefined): unknown[] {
  let next = 0
  return (blocks ?? []).flatMap((block) => {
    if (typeof block !== 'object' || block === null || (block as Record<string, unknown>).__component !== PLAYGROUND_COMPONENT) return []
    const position = positions?.[next++]
    return position === undefined ? [] : [{ ...block, position }]
  })
}

/**
 * The block of the draft's data at `request.address`, when it is a Playground block with a language and code; `undefined` otherwise.
 *
 * @remarks
 * Whether the playground has a runtime for the language is the island's to say (`PlaygroundEntry.canRun`), so this module imports none of the helpers that the public pages share. The block is found by its position in the CMS's zone (`position`, set by the draft route) and its catalogue id, never by what the page rendered, and what runs is only what the draft holds: the language, the code and the hidden setup of the saved block. Nothing of the message but its position is used.
 *
 * @param blocks - The draft's blocks of the zone, as the route sent them.
 * @param request - The message, already read.
 * @param zone - The zone `blocks` belongs to; an address in another zone names no block of this draft.
 */
export function runnableAt(blocks: ReadonlyArray<unknown> | null | undefined, request: RunRequest, zone: PreviewRunOptions['zone']): RunnableBlock | undefined {
  const { address } = request
  if (address.zone !== zone || address.block !== 'playground') return undefined
  // The position is the block's place in the CMS's zone, which the route kept on the block (`position`): a section the route dropped before it does not shift it
  const block = blocks?.find(candidate => typeof candidate === 'object' && candidate !== null && (candidate as Record<string, unknown>).position === address.index)
  if (typeof block !== 'object' || block === null) return undefined
  const { __component: component, runtime, code, setup } = block as Record<string, unknown>
  if (component !== PLAYGROUND_COMPONENT || typeof runtime !== 'string' || typeof code !== 'string') return undefined
  return { runtime, code, setup: textOf(setup) }
}

/**
 * Runs `block` in the Worker of its runtime, behind the runs already using it, in the pool the reader's Run button uses.
 *
 * @remarks
 * `started` is true once the runtime had loaded, which tells an error of the code from a runtime that never came up.
 */
export async function runForPreview(entry: PlaygroundEntry, block: RunnableBlock): Promise<PreviewRunOutcome> {
  let started = false
  const outcome = await entry.workers().run({ ...block, onStarted: () => {
    started = true
  } }).result
  return { status: outcome.status, output: outcome.output, truncated: outcome.truncated, started }
}

/**
 * Answers a `micelio:run`: finds the block, runs it in the Worker and says how it ended.
 *
 * @remarks
 * `null` means no answer: the run was stopped because the frame is going away. The output is already cut at 64 KB by the pool of Workers, which the reader's Run button shares, and a failure carries no more than the message of the code's own error; the stack, a path or a URL of the frame never leave it. The island's entry is imported on every run until one succeeds, so after `runtimeUnavailable` the frame keeps no state and the next run tries again.
 *
 * @param request - The message, already read.
 * @param options - The draft's blocks and the way to load the island's entry.
 */
export async function answerRun(request: RunRequest, options: PreviewRunOptions): Promise<RunResultPayload | null> {
  const { requestId, address } = request
  const fail = (reason: 'codeError' | 'timeout' | 'runtimeUnavailable' | 'notRunnable', output?: string): RunResultPayload => ({ requestId, address, ok: false, reason, ...(output !== undefined && { output }) })
  const block = runnableAt(options.positions ? withPositions(options.blocks(), options.positions()) : options.blocks(), request, options.zone)
  if (!block) return fail('notRunnable')
  let entry: PlaygroundEntry
  try {
    entry = await options.load()
  } catch {
    return fail('runtimeUnavailable')
  }
  // A language the playground has no runtime for is not something to run, as for the Run button
  if (!entry.canRun(block.runtime)) return fail('notRunnable')
  try {
    const outcome = await runForPreview(entry, block)
    if (outcome.status === 'stopped') return null
    if (outcome.status === 'timeout') return fail('timeout')
    // An error before the runtime had loaded is the runtime's, not the code's
    if (outcome.status === 'error') return outcome.started ? fail('codeError', outcome.output) : fail('runtimeUnavailable')
    return { requestId, address, ok: true, output: outcome.output, truncated: outcome.truncated }
  } catch {
    return fail('runtimeUnavailable')
  }
}
