import { describe, expect, it } from 'vitest'
import { sharedWithLoader } from '../modules/lib/islands-graph'
import type { BuiltChunk } from '../modules/lib/islands-graph'

const entry = (name: string, imports: string[] = []): BuiltChunk => ({ fileName: `${name}-h.js`, name, isEntry: true, imports })
const chunk = (name: string, imports: string[] = []): BuiltChunk => ({ fileName: `chunks/${name}.js`, name, isEntry: false, imports })

describe('sharedWithLoader', () => {
  it('accepts a loader and an island with separate chunks', () => {
    const chunks = [entry('loader', ['chunks/trigger.js']), chunk('trigger'), entry('mermaid', ['chunks/hydrated.js']), chunk('hydrated'), entry('search', ['chunks/trigger.js'])]
    expect(sharedWithLoader(chunks, ['mermaid'])).toEqual([])
  })

  it('reports a chunk both import, even through another chunk', () => {
    const chunks = [entry('loader', ['chunks/trigger.js']), chunk('trigger'), entry('mermaid', ['chunks/a.js']), chunk('a', ['chunks/trigger.js'])]
    const problems = sharedWithLoader(chunks, ['mermaid'])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('"mermaid" imports chunks/trigger.js')
  })

  it('ignores light islands and a build without a loader', () => {
    const chunks = [entry('loader', ['chunks/trigger.js']), chunk('trigger'), entry('search', ['chunks/trigger.js'])]
    expect(sharedWithLoader(chunks, ['mermaid'])).toEqual([])
    expect(sharedWithLoader([entry('mermaid', ['chunks/x.js']), chunk('x')], ['mermaid'])).toEqual([])
  })

  it('survives a cycle', () => {
    const chunks = [entry('loader', ['chunks/a.js']), chunk('a', ['chunks/b.js']), chunk('b', ['chunks/a.js']), entry('mermaid', ['chunks/b.js'])]
    expect(sharedWithLoader(chunks, ['mermaid'])).toHaveLength(1)
  })

  it('reports an island that imports the loader\'s own entry chunk', () => {
    const loader = entry('loader')
    expect(sharedWithLoader([loader, entry('mermaid', [loader.fileName])], ['mermaid'])).toHaveLength(1)
  })
})
