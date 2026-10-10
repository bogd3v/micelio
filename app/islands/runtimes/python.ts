// Python runtime of the playground: CPython compiled to WebAssembly (Pyodide), the core interpreter and the standard library only.
// The files come from modules/lib/pyodide-assets.ts, emitted under /_islands/runtimes/<PYODIDE_DIR>/ (the one path the Worker may fetch from).
// No packages: no micropip, no package loading. Notes on what reader code can reach: docs/security.md, "Python runtime".
// Each run gets a namespace of its own, but the interpreter does not: imported modules, `builtins` and the in-memory file system
// persist across every Python block of the page, setup code included (docs/security.md).
import { PYODIDE_DIR } from 'virtual:micelio-pyodide'
import type { PyodideAPI } from 'pyodide'
import { OutputBuffer, readableTraceback } from '../../helpers/pythonOutput'
import type { Runtime, RunLimits } from '../types'

interface PyodideModule {
  loadPyodide: (options: Record<string, unknown>) => Promise<PyodideAPI>
}

// What the `js` module offers Python: timers (asyncio's loop), console and the language's own constructors. Not the Worker's
// scope: no postMessage, self, globalThis, WebAssembly, ArrayBuffer, crypto, Blob or URL. An extra layer; the boundary is the
// Worker policy and the removal of the network globals (docs/security.md)
const BUILTINS = ['console', 'Object', 'Array', 'Promise', 'Symbol', 'Error', 'TypeError', 'RangeError', 'JSON', 'Math', 'Date', 'Number', 'String', 'Boolean', 'BigInt', 'Map', 'Set'] as const

type TimerId = ReturnType<typeof setTimeout>
type Callback = (...args: unknown[]) => unknown

interface Restricted {
  globals: object
  /** Clears every timer a run left live. */
  clearTimers: () => void
}

function restrictedGlobals(): Restricted {
  const scope = globalThis as unknown as Record<string, unknown>
  const kept: Record<string, unknown> = {}
  const live = new Set<TimerId>()
  const real = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    queueMicrotask: globalThis.queueMicrotask.bind(globalThis),
  }
  // A timer calls its callback with `this` set to the Worker's scope, and a Python proxy made with `capture_this=True` would receive it.
  // The callback is called from an arrow of ours instead, with only the reader's own arguments; a string of code is refused
  function callback(handler: unknown): Callback {
    if (typeof handler !== 'function') throw new TypeError('The timer needs a function')
    return handler as Callback
  }
  kept.setTimeout = (handler: unknown, delay?: number, ...args: unknown[]): TimerId => {
    const run = callback(handler)
    const id = real.setTimeout(() => {
      live.delete(id)
      run(...args)
    }, delay)
    live.add(id)
    return id
  }
  kept.setInterval = (handler: unknown, delay?: number, ...args: unknown[]): TimerId => {
    const run = callback(handler)
    const id = real.setInterval(() => run(...args), delay)
    live.add(id)
    return id
  }
  kept.clearTimeout = (id?: TimerId): void => {
    if (id !== undefined) live.delete(id)
    real.clearTimeout(id)
  }
  kept.clearInterval = (id?: TimerId): void => {
    if (id !== undefined) live.delete(id)
    real.clearInterval(id)
  }
  kept.queueMicrotask = (handler: unknown): void => {
    const run = callback(handler)
    real.queueMicrotask(() => {
      run()
    })
  }
  for (const name of BUILTINS) if (name in scope) kept[name] = scope[name]
  return {
    globals: Object.freeze(kept),
    clearTimers: () => {
      for (const id of live) {
        real.clearTimeout(id)
        real.clearInterval(id)
      }
      live.clear()
    },
  }
}

/**
 * Loads Pyodide for Python and returns the runtime that the playground Worker runs code with.
 *
 * @remarks
 * Runs in the playground Worker, never on the page. The Worker imports this chunk on the first Python run, and the Pyodide loader is imported by URL from the folder beside it, because its files are not bundled. Python sees only an allow-list of JavaScript globals, and `input()` reads the end of the input. Tasks and timers left by a run are cancelled and cleared when it ends. A task that does not stop, or a failed cleanup, sets `recycle`, which asks the pool to replace the Worker.
 */
export default async function load(): Promise<Runtime> {
  // Next to this chunk; the files are not bundled (Pyodide loads its siblings by name), so the import is by URL
  const folder = new URL(PYODIDE_DIR + '/', import.meta.url).href
  const { loadPyodide } = await import(/* @vite-ignore */ `${folder}pyodide.mjs`) as PyodideModule
  // Replaced by every run, with the room the Worker allows (twice what is shown: the page cuts it)
  let output = new OutputBuffer(0)
  let room = 0
  // Set when the interpreter may be broken or holds memory it cannot give back: the Worker is replaced (Runtime.recycle)
  let broken = false
  const restricted = restrictedGlobals()
  const pyodide = await loadPyodide({
    indexURL: folder,
    jsglobals: restricted.globals,
    // The Worker cannot ask anything: input() reads the end of the input
    stdin: () => null,
    checkAPIVersion: true,
  })
  // Raw writes, not lines: stdout and stderr land in the same output in order, and a partial line is not held back by Pyodide
  const writer = (): { write: (bytes: Uint8Array) => number } => {
    const decoder = new TextDecoder()
    return {
      write: (bytes) => {
        output.push(decoder.decode(bytes, { stream: true }))
        return bytes.length
      },
    }
  }
  pyodide.setStdout(writer())
  pyodide.setStderr(writer())

  // The streams Pyodide set up, in a namespace of our own that the runs never get: a run starts with them again if the reader's
  // code replaced them, and a line without its newline (`print('x', end='')`) stays in Python's buffer until it is flushed
  const helpers = pyodide.globals.get('dict')()
  pyodide.runPython([
    'import sys',
    'streams = (sys.stdout, sys.stderr)',
    'def restore():',
    '    sys.stdout, sys.stderr = streams',
    'def flush():',
    '    for stream in streams:',
    '        stream.flush()',
    'import asyncio',
    'async def settle():',
    '    tasks = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]',
    '    for task in tasks:',
    '        task.cancel()',
    '    if not tasks:',
    '        return 0',
    '    done, pending = await asyncio.wait(tasks, timeout=0.5)',
    '    return len(pending)',
  ].join('\n'), { globals: helpers })
  const restoreStreams = helpers.get('restore') as () => void
  const flushStreams = helpers.get('flush') as () => void

  // Work that outlives the run (an asyncio task, a timer) would burn CPU with no clock and write into later runs: tasks are cancelled and
  // awaited, then the timers cleared. A task that does not stop leaves the interpreter in a state nobody knows: the Worker is replaced
  async function endBackgroundWork(): Promise<void> {
    try {
      const stuck = await pyodide.runPythonAsync('await settle()', { globals: helpers }) as number
      if (stuck > 0) broken = true
    } catch {
      broken = true
    }
    restricted.clearTimers()
  }

  // What the program printed, without the newline of its last line (the output is shown as a block of text)
  function printed(): string {
    return output.text().replace(/\n$/, '').slice(0, room)
  }

  function flush(): void {
    try {
      flushStreams()
    } catch {
      // The streams were closed by the reader's code; what was written stays
    }
  }

  // A Python exception is an ordinary end of a run. Anything else (a WebAssembly trap, a fatal error of Pyodide, memory that ran out) leaves
  // the interpreter in a state nobody knows, and a MemoryError leaves its heap grown
  function isFatal(error: unknown): boolean {
    const type = (error as { type?: unknown } | null)?.type
    return typeof type !== 'string' || type === 'MemoryError' || type === 'RecursionError'
  }

  return {
    recycle: () => broken,
    async run(code: string, setup: string, limits: RunLimits): Promise<string> {
      room = limits.outputBytes * 2
      output = new OutputBuffer(room)
      restoreStreams()
      // A namespace of its own per run, as `python script.py` would give
      const globals = pyodide.globals.get('dict')()
      globals.set('__name__', '__main__')
      try {
        if (setup.trim()) await pyodide.runPythonAsync(setup, { globals })
        await pyodide.runPythonAsync(code, { globals })
        await endBackgroundWork()
        flush()
        return printed()
      } catch (error) {
        // What the program printed before it failed comes first, as in a terminal
        if (isFatal(error)) broken = true
        else await endBackgroundWork()
        flush()
        // Cut before it is read: a huge message must not cross to the page whole (room counts characters, UTF-16 units)
        const message = readableTraceback((error instanceof Error ? error.message : String(error)).slice(0, room))
        throw new Error([printed(), message].filter(Boolean).join('\n').slice(0, room), { cause: error })
      } finally {
        globals.destroy()
      }
    },
  }
}
