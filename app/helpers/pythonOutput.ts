// Text handling of the Python runtime of the playground (Pyodide). Pure, so it is unit-tested without a browser.

/** Collects what Python prints; past `limit` characters (UTF-16 units) it stops storing, so a loop that prints for ever cannot fill the memory. */
export class OutputBuffer {
  private chunks: string[] = []
  private size = 0

  constructor(private readonly limit: number) {}

  push(chunk: string): void {
    // Only what fits under the limit is stored; the rest is dropped
    const room = this.limit - this.size
    if (room <= 0) return
    const kept = chunk.length > room ? chunk.slice(0, room) : chunk
    this.chunks.push(kept)
    this.size += kept.length
  }

  text(): string {
    return this.chunks.join('')
  }

  clear(): void {
    this.chunks = []
    this.size = 0
  }
}

// Frames of Pyodide's own code (`/lib/python314.zip/_pyodide/_base.py`)
const INTERNAL_FRAME = /^ {2}File "\/lib\/python[^"]*", line \d+, in .*\n(?: {4}.*\n)*/gm
const READER_FRAME = '  File "<exec>"'

/** A Pyodide error message as the reader should read it: the traceback from their own code. Only the frames above the first `File "<exec>"` are dropped; those below it stay, the standard library's included. */
export function readableTraceback(message: string): string {
  const start = message.indexOf(READER_FRAME)
  if (start < 0) return message.replace(INTERNAL_FRAME, '').trim()
  return (message.slice(0, start).replace(INTERNAL_FRAME, '') + message.slice(start)).trim()
}
