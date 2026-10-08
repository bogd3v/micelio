// Dedicated Worker of the playground (ADR 0004, worker containment). It is served from /_islands/workers/ with its own CSP, loads the
// runtime of its first request, removes the network globals and then only runs code. One Worker serves one runtime.
import { capOutput } from '../../helpers/playgroundRunner'
import type { WorkerReply, WorkerRequest } from '../../helpers/playgroundRunner'
import { removeNetworkGlobals } from '../../helpers/workerSandbox'
import type { Runtime } from '../runtimes/runtime'

// One loader per runtime; a runtime is a chunk fetched from /_islands/runtimes/ the first time it is needed
const LOADERS: Readonly<Record<string, () => Promise<{ default: () => Promise<Runtime> }>>> = {
  sql: () => import('../runtimes/sql'),
}

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
  try {
    const runtime = await load(String(request.runtime))
    reply({ type: 'started', id: request.id })
    const { text, truncated } = capOutput(await runtime.run(String(request.code), String(request.setup)))
    reply({ type: 'done', id: request.id, output: text, truncated })
  } catch (error) {
    reply({ type: 'error', id: request.id, message: error instanceof Error ? error.message : String(error) })
  }
})
