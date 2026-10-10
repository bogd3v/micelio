// Types shared by the islands, their loader, the Worker, the helpers and the build (ADR 0006, ADR 0004). Declarations only.

/** What an island needs from the browser; one it lacks leaves the server fallback in place. */
export type HeavyFeature = 'webgl2' | 'wasm' | 'worker'

/** `visible`: near the viewport, after load and idle. `interaction`: a click or key on the island's control. */
export type HeavyTrigger = 'visible' | 'interaction'

/** What `Save-Data` does to a `visible` island: `skip` keeps the fallback (the default), `load` loads it anyway. An `interaction` island always loads. */
export type HeavySaveData = 'load' | 'skip'

/**
 * CSP additions for the responses of the pages that render the island (ADR 0004, ADR 0006).
 * Sources are `'self'` or absolute `https://` origins with an optional path (`http://` only for localhost).
 */
export interface HeavyCsp {
  connectSrc?: string[]
  workerSrc?: string[]
  /** Adds `'wasm-unsafe-eval'` to `script-src`. */
  wasm?: true
}

/** One entry of the heavy island registry (`HEAVY_ISLANDS`). */
export interface HeavyIsland {
  /** Block or section the island belongs to (`mermaid`, `playground`, `scene`). */
  id: string
  /** File name, without extension, in `app/islands/`. */
  entry: string
  trigger: HeavyTrigger
  /** What the server markup shows without the island: a poster, the source code, the diagram's source. */
  fallback: string
  features: HeavyFeature[]
  saveData?: HeavySaveData
  /** `interaction` only, required: attribute selector (`[data-playground-run]`), inside the element, of the control whose press loads the island. */
  control?: string
  /** The island animates: under `prefers-reduced-motion: reduce` the loader never imports it and the fallback stays (ADR 0006, amendment of #246). */
  motion?: true
  csp?: HeavyCsp
  /** Key under `islands` in `scripts/perf/budgets.json`. */
  budget: string
}

/** What the Worker allows a run. Passed in, not imported: a runtime chunk must not import a module the Worker script holds (WebKit evaluates the script twice). */
export interface RunLimits {
  /** The interpreter should stop by itself within this many ms; the Worker is terminated soon after. */
  deadlineMs: number
  /** Output the reader is shown, in bytes; a runtime may stop producing more than this (its units may be smaller than bytes). */
  outputBytes: number
}

/** What a playground runtime offers the Worker; a runtime is `export default` of its module in `app/islands/runtimes/`. */
export interface Runtime {
  /** Runs `setup` (hidden) and then `code`; returns the text to show. Throws a readable error. */
  run: (code: string, setup: string, limits: RunLimits) => string | Promise<string>
  /** Asked after every run, whether it ended well or not: true when the runtime may be broken or holds memory it cannot give back, so the Worker is replaced. */
  recycle?: () => boolean
}

/** Main thread -> Worker. */
export interface WorkerRequest {
  type: 'run'
  id: number
  runtime: string
  code: string
  setup: string
}

/** Worker -> main thread. `started`: the runtime is loaded and the code is about to run. `recycle`: the Worker should not run again (the pool replaces it). */
export type WorkerReply
  = | { type: 'started', id: number }
    | { type: 'done', id: number, output: string, truncated: boolean, recycle?: boolean }
    | { type: 'error', id: number, message: string, recycle?: boolean }

/** How a playground run ended. */
export type RunStatus = 'done' | 'error' | 'timeout' | 'stopped'

/** What the playground island shows after a run. */
export interface RunResult {
  status: RunStatus
  /** Output, or the error message for `error`. Always plain text. */
  output: string
  truncated: boolean
}
