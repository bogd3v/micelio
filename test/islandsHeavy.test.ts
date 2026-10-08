import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEAVY_ISLANDS, validateHeavyIslands } from '../app/islands/heavy'
import type { HeavyIsland } from '../app/islands/heavy'

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
    expect(validateHeavyIslands([{ ...valid, entry: 'heavy' }])[0]).toContain('entry must name')
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
