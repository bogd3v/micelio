/** What a playground runtime offers the Worker; a runtime is `export default` of its module in `app/islands/runtimes/`. */
export interface Runtime {
  /** Runs `setup` (hidden) and then `code`; returns the text to show. Throws a readable error. */
  run: (code: string, setup: string) => string | Promise<string>
}
