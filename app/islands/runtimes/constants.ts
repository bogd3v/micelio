// Runtimes must not import this file: the limits reach them as `RunLimits` (docs/security.md, WebKit).
// What the playground island and its Worker agree on (ADR 0004, worker containment). Apart from `../constants.ts` on purpose:
// a module that two island entries import becomes a chunk of its own, one more request for each (docs/performance.md).

/** Longest a run may execute, in ms. The clock starts when the runtime is loaded, not when Run is pressed. */
export const RUN_TIMEOUT_MS = 5000
/** Longest the runtime may take to load, in ms: a hung download must not leave the button busy for ever. */
export const LOAD_TIMEOUT_MS = 60000
/** Output shown to the reader, in bytes of UTF-8. */
export const MAX_OUTPUT_BYTES = 64 * 1024
