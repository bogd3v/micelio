// What the playground island and its Worker agree on (ADR 0004, worker containment). Pure, so it is unit-tested without a browser.

/** Longest a run may execute, in ms. The clock starts when the runtime is loaded, not when Run is pressed. */
export const RUN_TIMEOUT_MS = 5000
/** Longest the runtime may take to load, in ms: a hung download must not leave the button busy for ever. */
export const LOAD_TIMEOUT_MS = 60000
/** Output shown to the reader, in bytes of UTF-8. */
export const MAX_OUTPUT_BYTES = 64 * 1024

/** Main thread -> Worker. */
export interface WorkerRequest {
  type: 'run'
  id: number
  runtime: string
  code: string
  setup: string
}

/** Worker -> main thread. `started`: the runtime is loaded and the code is about to run. */
export type WorkerReply
  = | { type: 'started', id: number }
    | { type: 'done', id: number, output: string, truncated: boolean }
    | { type: 'error', id: number, message: string }

export type RunStatus = 'done' | 'error' | 'timeout' | 'stopped'

export interface RunResult {
  status: RunStatus
  /** Output, or the error message for `error`. Always plain text. */
  output: string
  truncated: boolean
}

export interface CappedOutput {
  text: string
  truncated: boolean
}

/** `text` cut to at most `maxBytes` of UTF-8, never in the middle of a character. */
export function capOutput(text: string, maxBytes: number = MAX_OUTPUT_BYTES): CappedOutput {
  const encoder = new TextEncoder()
  // A UTF-16 unit is at most 3 bytes of UTF-8
  if (text.length * 3 <= maxBytes) return { text, truncated: false }
  const bytes = encoder.encode(text)
  if (bytes.length <= maxBytes) return { text, truncated: false }
  // A cut inside a character decodes to U+FFFD at the end; drop it
  return { text: new TextDecoder().decode(bytes.subarray(0, maxBytes)).replace(/�+$/, ''), truncated: true }
}

/** Whether `value` is a reply the Worker may send; anything else is ignored. */
export function isWorkerReply(value: unknown): value is WorkerReply {
  if (typeof value !== 'object' || value === null) return false
  const reply = value as Record<string, unknown>
  if (typeof reply.id !== 'number') return false
  if (reply.type === 'started') return true
  if (reply.type === 'done') return typeof reply.output === 'string' && typeof reply.truncated === 'boolean'
  return reply.type === 'error' && typeof reply.message === 'string'
}

/** `1.2 MB` or `640 KB` from kilobytes. */
export function formatDownload(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`
}

/** `{name}` placeholders of a label; a value is inserted as text, never interpreted. */
export function fillLabel(label: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, () => value), label)
}
