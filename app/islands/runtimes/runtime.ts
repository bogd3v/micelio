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
