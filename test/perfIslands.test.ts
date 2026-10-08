import { describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM script without types
import { islandBudgetErrors, islandElement, islandMetrics, islandProblems, isStrayRequest } from '../scripts/perf/islands.mjs'
import type { HeavyIsland } from '../app/islands/heavy'

const MERMAID: HeavyIsland = { id: 'mermaid', entry: 'mermaid', trigger: 'visible', fallback: 'the diagram source', features: [], budget: 'mermaid' }
const PLAYGROUND: HeavyIsland = { id: 'playground', entry: 'playground', trigger: 'interaction', fallback: 'the code', features: ['worker'], budget: 'playground' }
const BUDGET = { page: '/blog/diagrams', ready: 'micelio-mermaid svg', error: { scriptGzKb: 200 } }

function stray(pathname: string, { beforeLoad = true, isStatic = false, declaredScripts = [] as string[] } = {}): boolean {
  return isStrayRequest({ pathname, beforeLoad, isStatic, declaredScripts })
}

describe('isStrayRequest', () => {
  it('flags island code before the load event in every mode', () => {
    expect(stray('/_islands/mermaid-abc.js')).toBe(true)
    expect(stray('/_islands/chunks/x.js', { isStatic: true })).toBe(true)
  })

  it('lets a visible island load after the load event', () => {
    expect(stray('/_islands/mermaid-abc.js', { beforeLoad: false })).toBe(false)
    expect(stray('/_islands/workers/run.js', { beforeLoad: false, isStatic: true })).toBe(false)
  })

  it('never flags a script the HTML declares', () => {
    expect(stray('/_islands/search-abc.js', { isStatic: true, declaredScripts: ['/_islands/search-abc.js'] })).toBe(false)
  })

  it('flags Pagefind at any time before the search is used', () => {
    expect(stray('/pagefind/pagefind.js', { beforeLoad: false, isStatic: true })).toBe(true)
  })

  it('flags undeclared scripts on static pages only', () => {
    expect(stray('/_nuxt/lazy.js', { beforeLoad: false, isStatic: true })).toBe(true)
    expect(stray('/_nuxt/lazy.js')).toBe(false)
    expect(stray('/images/a.png', { isStatic: true })).toBe(false)
  })
})

describe('islandElement', () => {
  it('names the custom element after the island id', () => {
    expect(islandElement(MERMAID)).toBe('micelio-mermaid')
  })
})

describe('islandBudgetErrors', () => {
  it('passes an empty registry with only the search budget', () => {
    expect(islandBudgetErrors([], { static: { islands: { search: { error: { wasmKb: 80 } } } }, dynamic: {} })).toEqual([])
  })

  it('passes an island budgeted in one mode', () => {
    expect(islandBudgetErrors([MERMAID], { dynamic: { islands: { mermaid: BUDGET } }, static: {} })).toEqual([])
  })

  it('requires a budget for every island', () => {
    expect(islandBudgetErrors([MERMAID], { dynamic: {} })).toEqual(['island "mermaid" has no budget: add modes.<mode>.islands.mermaid to budgets.json'])
  })

  it('rejects a budget no island owns', () => {
    expect(islandBudgetErrors([], { dynamic: { islands: { scene: BUDGET } } })).toEqual(['modes.dynamic.islands.scene is not the budget of an island in app/islands/heavy.ts'])
  })

  it('checks the page, the selectors and the limits', () => {
    const errors = islandBudgetErrors([MERMAID, PLAYGROUND], {
      dynamic: {
        islands: {
          mermaid: { page: 'blog', control: 'button', ready: 'svg', error: { scriptGzKb: 200, lcpMs: 1 } },
          playground: { page: '/blog/run', control: '[data-playground-run]', ready: 3, error: {} },
        },
      },
    })
    expect(errors).toEqual([
      'modes.dynamic.islands.mermaid.page must be the path of a page that renders <micelio-mermaid>',
      'modes.dynamic.islands.mermaid.control is a CSS selector, and only for an island triggered by interaction',
      'modes.dynamic.islands.mermaid.error.lcpMs is not a heavy island metric (scriptGzKb, wasmKb, totalKb, requests)',
      'modes.dynamic.islands.playground.ready must be the CSS selector of the island\'s rendered result',
      'modes.dynamic.islands.playground.error needs at least one limit (scriptGzKb, wasmKb, totalKb, requests)',
    ])
  })

  it('rejects a limit that is not a number', () => {
    expect(islandBudgetErrors([MERMAID], { dynamic: { islands: { mermaid: { page: '/a', ready: 'svg', error: { wasmKb: '80' } } } } }))
      .toEqual(['modes.dynamic.islands.mermaid.error.wasmKb must be a number'])
  })
})

describe('islandMetrics', () => {
  it('sums scripts in gzip, WASM and the total as sent', () => {
    const files = [
      { path: '/_islands/mermaid-a.js', sent: 4096, gzip: 2048 },
      { path: '/_islands/workers/run.mjs', sent: 2048, gzip: 1024 },
      { path: '/_islands/runtimes/sqlite.wasm', sent: 10240, gzip: 9000 },
      { path: '/_islands/runtimes/data.bin', sent: 1024, gzip: 1000 },
    ]
    expect(islandMetrics(files)).toEqual({ scriptGzKb: 3, wasmKb: 10, totalKb: 17, requests: 4 })
  })

  it('is zero when nothing loaded', () => {
    expect(islandMetrics([])).toEqual({ scriptGzKb: 0, wasmKb: 0, totalKb: 0, requests: 0 })
  })
})

describe('islandProblems', () => {
  it('reports metrics over their limit and metrics that were not measured', () => {
    expect(islandProblems('mermaid', { scriptGzKb: 210, requests: 3 }, { scriptGzKb: 200, requests: 3, wasmKb: 0 })).toEqual([
      { level: 'error', page: 'island mermaid', metric: 'scriptGzKb', value: 210, limit: 200 },
      { level: 'error', page: 'island mermaid', metric: 'wasmKb', value: undefined, limit: 0 },
    ])
  })

  it('is empty within the limits', () => {
    expect(islandProblems('search', { wasmKb: 70 }, { wasmKb: 80 })).toEqual([])
  })
})
