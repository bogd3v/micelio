// JavaScript runtime of the playground: QuickJS compiled to WebAssembly, so the reader's code runs in its own interpreter inside the
// Worker, never in the Worker's realm (ADR 0004). The guest sees only `console`: no fetch, no timers, no modules, no eval.
// The package finds its .wasm next to itself, and the islands build emits it under /_islands/runtimes/ (modules/islands.ts).
import variant from '@jitl/quickjs-wasmfile-release-sync'
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core'
import type { QuickJSContext, QuickJSHandle, QuickJSRuntime } from 'quickjs-emscripten-core'
import type { RunLimits, Runtime } from './runtime'

// What the guest may hold, by QuickJS's own limits: a loop that builds an array or a string ends with an error before it can
// starve the Worker, and runaway recursion ends with a stack error instead of a crash
const MEMORY_LIMIT = 32 * 1024 * 1024
// QuickJS's own limit does not count every allocation (a big array filled in a loop slips by), so the WebAssembly memory has a hard
// ceiling too: what the guest cannot get, malloc refuses, and QuickJS answers "out of memory". The Worker never holds more than this.
const WASM_INITIAL_PAGES = 256
const WASM_MAX_PAGES = 2048
const STACK_LIMIT = 128 * 1024
// The deadline and the output cap come from the Worker (RunLimits). The interpreter stops itself before the Worker is terminated and says
// so, but it only sees interpreted code: a long built-in call (`new Array(1e8).join('x')`) is left to terminate() (docs/security.md)

// Runs in the guest before anything else. `eval` and every `Function` constructor throw: the host needs the Eval intrinsic to run
// the reader's code, so it stays on and the way to it from the guest is closed. Nothing the reader needs, and one less way to build
// code from strings (the guest could not leave QuickJS with it anyway).
const GUEST_PRELUDE = `(() => {
  const blocked = function () { throw new EvalError('Code generation from strings is disabled') }
  const prototypes = [Function.prototype, Object.getPrototypeOf(async function () {}), Object.getPrototypeOf(function* () {}), Object.getPrototypeOf(async function* () {})]
  for (const prototype of prototypes) Object.defineProperty(prototype, 'constructor', { value: blocked, configurable: false, writable: false })
  Object.defineProperty(globalThis, 'eval', { value: blocked, configurable: false, writable: false })
  Object.defineProperty(globalThis, 'Function', { value: blocked, configurable: false, writable: false })
})()`

const CONSOLE_METHODS: Readonly<Record<string, string>> = { log: '', info: '', warn: 'warn: ', error: 'error: ' }

/** What the guest did wrong (an error, an interrupt): the runtime is fine. Anything else thrown is the host failing. */
class GuestFailure extends Error {}

/** Messages of QuickJS when the guest ran out of what it was given: the engine may be left in a state not worth reusing. */
const EXHAUSTED = /out of memory|stack overflow/i

interface GuestError {
  name?: string
  message?: string
}

/** Text of a value the guest passed to `console` or returned: strings as they are, the rest as JSON or `String`. */
export function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined) return 'undefined'
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** The line a guest error is shown as. */
export function formatError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const { name, message } = error as GuestError
    if (typeof message === 'string') return `${typeof name === 'string' ? name : 'Error'}: ${message}`
  }
  return formatValue(error)
}

class Run {
  readonly lines: string[] = []
  private size = 0
  private logging = false
  /** The guest wrote more than the output can hold: it is interrupted and what it wrote is the output. */
  full = false
  private readonly deadline: number
  expired = false
  /** The run ended by the deadline, the output cap or an exhausted memory or stack: the Worker should be replaced. */
  exhausted = false

  constructor(private readonly runtime: QuickJSRuntime, readonly context: QuickJSContext, private readonly limits: RunLimits) {
    this.deadline = Date.now() + limits.deadlineMs
    runtime.setMemoryLimit(MEMORY_LIMIT)
    runtime.setMaxStackSize(STACK_LIMIT)
    runtime.setInterruptHandler(() => {
      if (!this.expired && Date.now() > this.deadline) this.expired = true
      return this.expired || this.full
    })
    this.installConsole()
  }

  /** Console output counts from here on (the hidden setup runs silent). */
  start(): void {
    this.logging = true
  }

  private installConsole(): void {
    const { context } = this
    const console = context.newObject()
    for (const [method, prefix] of Object.entries(CONSOLE_METHODS)) {
      const fn = context.newFunction(method, (...args: QuickJSHandle[]) => {
        if (!this.logging || this.full) return
        let line = prefix + args.map(arg => formatValue(context.dump(arg))).join(' ')
        // Sizes are UTF-16 units, at most 3 bytes each: twice the cap in units is more than the cap in bytes. Checked before the push,
        // so one huge line is cut here and never kept whole
        const room = this.limits.outputBytes * 2 - this.size
        if (line.length >= room) {
          line = line.slice(0, Math.max(room, 0))
          this.full = true
        }
        this.lines.push(line)
        this.size += line.length + 1
      })
      context.setProp(console, method, fn)
      fn.dispose()
    }
    context.setProp(context.global, 'console', console)
    console.dispose()
  }

  /** Evaluates `code`; returns the text of its value, or throws a guest error as an `Error`. */
  evaluate(code: string): string | undefined {
    const { context, runtime } = this
    const result = context.evalCode(code, 'playground.js')
    if (result.error) throw new GuestFailure(this.describe(this.readError(result.error)))
    const value = result.value
    try {
      // Callbacks of promises the code made run after it: their output counts
      const jobs = runtime.executePendingJobs()
      if (jobs.error) throw new GuestFailure(this.describe(this.readError(jobs.error)))
      // A promise chain that schedules itself runs out of time inside a job: the interrupt lands in a rejected promise, not in the code
      if (this.expired) throw new GuestFailure(this.describe(undefined))
      if (context.typeof(value) === 'undefined') return undefined
      const state = context.getPromiseState(value)
      if (state.type === 'fulfilled') {
        try {
          return state.notAPromise ? formatValue(context.dump(value)) : formatValue(context.dump(state.value))
        } finally {
          if (!state.notAPromise) state.value.dispose()
        }
      }
      if (state.type === 'rejected') {
        throw new GuestFailure(this.describe(this.readError(state.error)))
      }
      return 'Promise { <pending> }'
    } finally {
      value.dispose()
    }
  }

  // `name` and `message` as strings, read one by one: dumping a whole error object (a stack overflow one) leaves objects behind that abort the runtime's disposal
  private readError(handle: QuickJSHandle): GuestError {
    const { context } = this
    try {
      if (context.typeof(handle) !== 'object') return { message: formatValue(context.dump(handle)) }
      const read = (key: string): string | undefined => {
        const property = context.getProp(handle, key)
        try {
          return context.typeof(property) === 'string' ? context.getString(property) : undefined
        } finally {
          property.dispose()
        }
      }
      return { name: read('name'), message: read('message') }
    } finally {
      handle.dispose()
    }
  }

  private describe(error: unknown): string {
    if (this.expired) {
      this.exhausted = true
      return `Interrupted: the code ran for more than ${this.limits.deadlineMs / 1000} seconds`
    }
    // An error message is output too: it is cut like the rest
    const message = formatError(error).slice(0, this.limits.outputBytes)
    if (EXHAUSTED.test(message)) this.exhausted = true
    return message
  }
}

export default async function load(): Promise<Runtime> {
  const bounded = newVariant(variant, { wasmMemory: new WebAssembly.Memory({ initial: WASM_INITIAL_PAGES, maximum: WASM_MAX_PAGES }) })
  const quickjs = await newQuickJSWASMModuleFromVariant(bounded)
  // Set by every run: the engine hit a limit or the host failed, so the Worker is better replaced than reused
  let recycle = false
  return {
    recycle: () => recycle,
    run(code: string, setup: string, limits: RunLimits): string {
      recycle = false
      const runtime = quickjs.newRuntime()
      const context = runtime.newContext()
      const run = new Run(runtime, context, limits)
      try {
        run.evaluate(GUEST_PRELUDE)
        if (setup.trim()) run.evaluate(setup)
        run.start()
        let value: string | undefined
        let failure: Error | undefined
        try {
          value = run.evaluate(code)
        } catch (error) {
          failure = error instanceof Error ? error : new Error(String(error))
        }
        // The host failing (not the guest) leaves the engine in doubt
        if (failure && !(failure instanceof GuestFailure)) throw failure
        // A guest that filled the output was interrupted on purpose: what it wrote is the result
        if (failure && !run.full) throw new GuestFailure([...run.lines, failure.message].join('\n'))
        if (value !== undefined && !run.full) run.lines.push(value)
        return run.lines.join('\n')
      } catch (error) {
        if (!(error instanceof GuestFailure)) recycle = true
        throw error
      } finally {
        recycle ||= run.exhausted || run.full
        try {
          context.dispose()
          runtime.dispose()
        } catch {
          // The engine could not free what the run left (queued jobs of an interrupted chain, say): the run's own outcome stands, the Worker goes
          recycle = true
        }
      }
    },
  }
}
