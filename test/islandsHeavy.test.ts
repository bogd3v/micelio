import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEAVY_ISLANDS } from '../app/islands/lib/constants'
import { validateHeavyIslands } from '../app/islands/heavy'
import type { HeavyIsland } from '../app/islands/types'

const valid: HeavyIsland = {
  id: 'mermaid',
  entry: 'mermaid',
  trigger: 'visible',
  fallback: 'The diagram source in a code block',
  features: [],
  budget: 'mermaid',
}

describe('heavy island registry', () => {
  it('is valid and its entries exist in app/islands', () => {
    expect(validateHeavyIslands(HEAVY_ISLANDS)).toEqual([])
    for (const island of HEAVY_ISLANDS) expect(existsSync(join(__dirname, '..', 'app', 'islands', `${island.entry}.ts`)), island.id).toBe(true)
  })

  it('accepts a complete entry with CSP sources', () => {
    const island: HeavyIsland = { ...valid, id: 'playground', features: ['wasm', 'worker'], csp: { connectSrc: ['\'self\'', 'https://cdn.example.com:8443/runtimes/', 'http://localhost:3000'], workerSrc: ['\'self\''], wasm: true } }
    expect(validateHeavyIslands([valid, island])).toEqual([])
  })

  it('rejects duplicate ids, bad names and the registry as an entry', () => {
    expect(validateHeavyIslands([valid, valid])).toEqual(['island "mermaid": duplicate id'])
    expect(validateHeavyIslands([{ ...valid, id: 'Bad Id' }])[0]).toContain('id must be')
    for (const entry of ['heavy', 'types', 'constants']) expect(validateHeavyIslands([{ ...valid, entry }])[0]).toContain('entry must name')
    expect(validateHeavyIslands([{ ...valid, entry: '../x' }])[0]).toContain('entry must name')
  })

  it('rejects an unknown trigger or feature and empty text', () => {
    expect(validateHeavyIslands([{ ...valid, trigger: 'hover' as never }])[0]).toContain('unknown trigger')
    expect(validateHeavyIslands([{ ...valid, features: ['gpu' as never] }])[0]).toContain('unknown feature')
    expect(validateHeavyIslands([{ ...valid, fallback: ' ' }])[0]).toContain('fallback')
    expect(validateHeavyIslands([{ ...valid, budget: '' }])[0]).toContain('budget')
  })

  it('validates saveData and the control of an interaction island', () => {
    expect(validateHeavyIslands([{ ...valid, saveData: 'load' }])).toEqual([])
    expect(validateHeavyIslands([{ ...valid, saveData: 'maybe' as never }])[0]).toContain('unknown saveData')
    const play: HeavyIsland = { ...valid, id: 'playground', entry: 'mermaid', trigger: 'interaction', budget: 'playground', control: '[data-playground-run]' }
    expect(validateHeavyIslands([play])).toEqual([])
    expect(validateHeavyIslands([{ ...play, control: undefined }])[0]).toContain('needs a control')
    expect(validateHeavyIslands([{ ...play, control: 'button.run' }])[0]).toContain('needs a control')
    expect(validateHeavyIslands([{ ...valid, control: '[data-x]' }])[0]).toContain('only an interaction island')
  })

  it('rejects CSP sources that could add a directive or a wildcard', () => {
    for (const source of ['*', '\'unsafe-eval\'', 'https://a.com; script-src *', 'https://*.example.com', 'data:', '//evil.com', '/_islands/runtimes/', 'http://example.com', '']) {
      expect(validateHeavyIslands([{ ...valid, csp: { connectSrc: [source] } }]), source).toHaveLength(1)
    }
    expect(validateHeavyIslands([{ ...valid, csp: { wasm: false as never } }])[0]).toContain('csp.wasm')
    expect(validateHeavyIslands([{ ...valid, motion: true }])).toEqual([])
    expect(validateHeavyIslands([{ ...valid, motion: false as never }])[0]).toContain('motion')
    expect(validateHeavyIslands([{ ...valid, csp: { workerSrc: 'blob:' as never } }])[0]).toContain('must be an array')
  })
})

// The island declaration of the blocks of the catalogue, copied from `contract/blocks.ts` and `contract/islands.ts` of micelio-plugin-core at
// 7f9536d (the package is not published yet, as test/preview.test.ts does with the preview schema). `loadKb` is the weight of the default runtime only.
const ON_CLICK_ABOVE_KB = 1024
const CATALOGUE_ISLANDS: Record<string, { kind: '3d' | 'runtime' | 'media' | 'diagram' | 'data', loadKb: number }> = {
  scene: { kind: '3d', loadKb: 151.3 },
  playground: { kind: 'runtime', loadKb: 406.7 },
}
// Not a catalogue block: the diagram lives inside the `prose` block, so the catalogue has no `loadKb` for it (docs/architecture/islands.md)
const NOT_A_BLOCK: Record<string, HeavyIsland['trigger']> = { mermaid: 'visible' }

/** The load rule of docs/architecture/islands.md: a runtime runs when the visitor asks, and a heavy island loads on a click. */
function expectedTrigger(island: { kind: string, loadKb: number }): HeavyIsland['trigger'] {
  return island.kind === 'runtime' || island.loadKb > ON_CLICK_ABOVE_KB ? 'interaction' : 'visible'
}

describe('heavy island registry and the catalogue', () => {
  it('a runtime island or one above 1 MB in the catalogue loads on interaction, any other in view', () => {
    for (const [id, declared] of Object.entries(CATALOGUE_ISLANDS)) {
      expect(HEAVY_ISLANDS.find(island => island.id === id)?.trigger, id).toBe(expectedTrigger(declared))
    }
    // The rule itself, on the four cases it distinguishes
    expect(expectedTrigger({ kind: 'runtime', loadKb: 406.7 })).toBe('interaction')
    expect(expectedTrigger({ kind: '3d', loadKb: 1025 })).toBe('interaction')
    expect(expectedTrigger({ kind: '3d', loadKb: 1024 })).toBe('visible')
    expect(expectedTrigger({ kind: '3d', loadKb: 151.3 })).toBe('visible')
    // An interaction island has the control that loads it
    for (const island of HEAVY_ISLANDS.filter(item => item.id in CATALOGUE_ISLANDS && item.trigger === 'interaction')) expect(island.control, island.id).toBeTruthy()
  })

  it('every registry island is a catalogue block except mermaid, which lives inside prose', () => {
    const ids = HEAVY_ISLANDS.map(island => island.id)
    expect(ids.filter(id => !(id in CATALOGUE_ISLANDS) && !(id in NOT_A_BLOCK))).toEqual([])
    expect(Object.keys(CATALOGUE_ISLANDS).filter(id => !ids.includes(id))).toEqual([])
    for (const [id, trigger] of Object.entries(NOT_A_BLOCK)) expect(HEAVY_ISLANDS.find(island => island.id === id)?.trigger, id).toBe(trigger)
  })
})
