// Checks on the chunk graph of the islands build (ADR 0006, section 6). Pure, so a test can feed it a graph.

export interface BuiltChunk {
  /** File name in the output folder, e.g. `chunks/trigger-AbC.js`. */
  fileName: string
  /** Entry name for an entry chunk (`loader`, `mermaid`). */
  name: string
  isEntry: boolean
  /** Chunks it imports statically (file names). */
  imports: string[]
}

export const LOADER_ENTRY = 'loader'

function staticClosure(start: BuiltChunk, byFile: Map<string, BuiltChunk>): Set<string> {
  const seen = new Set<string>()
  const pending = [...start.imports]
  while (pending.length) {
    const file = pending.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    pending.push(...(byFile.get(file)?.imports ?? []))
  }
  return seen
}

/**
 * Problems, one message each: a heavy island's entry that imports (even through other chunks) a chunk the loader imports.
 * The loader runs at start, so that chunk would load at start too, with the island's bytes in the initial requests.
 */
export function sharedWithLoader(chunks: readonly BuiltChunk[], heavyEntries: readonly string[]): string[] {
  const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
  const loader = chunks.find(chunk => chunk.isEntry && chunk.name === LOADER_ENTRY)
  if (!loader) return []
  const loaded = staticClosure(loader, byFile)
  return chunks
    .filter(chunk => chunk.isEntry && heavyEntries.includes(chunk.name))
    .flatMap((chunk) => {
      const shared = [...staticClosure(chunk, byFile)].filter(file => loaded.has(file))
      return shared.length ? [`heavy island entry "${chunk.name}" imports ${shared.join(', ')}, which the loader imports too: the loader would load it at start. Do not import the same module from both`] : []
    })
}
