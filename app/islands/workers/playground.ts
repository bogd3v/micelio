// Dedicated Worker of the playground (ADR 0004, worker containment). It is served from /_islands/workers/ with its own CSP, loads the
// runtime of its first request, removes the network globals and then only runs code. One Worker serves one runtime.
import { capOutput, MAX_OUTPUT_BYTES, RUN_TIMEOUT_MS } from '../../helpers/playgroundRunner'
import type { WorkerReply, WorkerRequest } from '../../helpers/playgroundRunner'
import { removeNetworkGlobals } from '../../helpers/workerSandbox'
import type { Runtime, RunLimits } from '../runtimes/runtime'

// One loader per runtime; a runtime is a chunk fetched from /_islands/runtimes/ the first time it is needed
const LOADERS: Readonly<Record<string, () => Promise<{ default: () => Promise<Runtime> }>>> = {
  sql: () => import('../runtimes/sql'),
  javascript: () => import('../runtimes/javascript'),
}

// The interpreter of a runtime stops a second before the Worker is terminated, so it can say why
const LIMITS: RunLimits = { deadlineMs: RUN_TIMEOUT_MS - 1000, outputBytes: MAX_OUTPUT_BYTES }

let loaded: { name: string, runtime: Runtime } | undefined

function reply(message: WorkerReply): void {
  self.postMessage(message)
}

async function load(name: string): Promise<Runtime> {
  if (loaded) {
    if (loaded.name !== name) throw new Error(`This Worker runs ${loaded.name}, not ${name}`)
    return loaded.runtime
  }
  const loader = Object.hasOwn(LOADERS, name) ? LOADERS[name] : undefined
  if (!loader) throw new Error(`Unknown runtime: ${name}`)
  const runtime = await (await loader()).default()
  // Everything the runtime needs is in memory now: no more network, no nested workers
  removeNetworkGlobals(self)
  loaded = { name, runtime }
  return runtime
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request?.type !== 'run' || typeof request.id !== 'number') return
  let runtime: Runtime | undefined
  try {
    runtime = await load(String(request.runtime))
    reply({ type: 'started', id: request.id })
    const { text, truncated } = capOutput(await runtime.run(String(request.code), String(request.setup), LIMITS))
    reply({ type: 'done', id: request.id, output: text, truncated, recycle: runtime.recycle?.() })
  } catch (error) {
    // A message is output too: it never goes out whole
    reply({ type: 'error', id: request.id, message: capOutput(error instanceof Error ? error.message : String(error)).text, recycle: runtime?.recycle?.() })
  }
})
