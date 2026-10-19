import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { publicDeclarations, slotApiSections, unlistedPublicFiles } from '../scripts/theme-reference/slot-apis'

const SOURCE = `
/** Not part of the contract. */
export function internal(): void {}

/**
 * Doubles a number.
 *
 * @param value - The number to double.
 * @returns The double.
 *
 * @example
 * \`\`\`ts
 * double(2) // 4
 * \`\`\`
 *
 * @public
 */
export function double(value: number): number {
  return value * 2
}

/**
 * A thing.
 *
 * @public
 */
export interface Thing {
  /** The id. */
  id: string
}

/**
 * Slugs.
 *
 * @public
 */
export const SLUGS: readonly string[] = ['a', 'b']
`

describe('publicDeclarations', () => {
  const found = publicDeclarations('sample.ts', SOURCE)

  it('keeps only the declarations tagged public, in source order', () => {
    expect(found.map(item => item.name)).toEqual(['double', 'Thing', 'SLUGS'])
  })

  it('reads the summary, parameters, result and example', () => {
    const [double] = found
    expect(double).toMatchObject({ kind: 'function', summary: 'Doubles a number.', returns: 'The double.' })
    expect(double!.params).toEqual([{ name: 'value', text: 'The number to double.' }])
    expect(double!.examples[0]).toContain('double(2) // 4')
  })

  it('writes a function without its body and a typed constant without its value', () => {
    expect(found[0]!.signature).toBe('export function double(value: number): number')
    expect(found[2]!.signature).toBe('export const SLUGS: readonly string[]')
  })

  it('keeps the whole initializer of a constant without a type annotation', () => {
    const [item] = publicDeclarations('c.ts', '/** Modules.\n * @public\n */\nexport const MODULES = [\'a\', \'b\'] as const')
    expect(item!.signature).toBe('export const MODULES = [\'a\', \'b\'] as const')
  })

  it('marks an interface whose fields are documented', () => {
    expect(found[1]).toMatchObject({ kind: 'interface', hasMemberDocs: true })
  })
})

describe('slot API groups', () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  function project(extra: Record<string, string> = {}): string {
    const root = mkdtempSync(join(tmpdir(), 'slot-apis-'))
    roots.push(root)
    for (const [file, text] of Object.entries({
      'app/composables/useSite.ts': '/** The site.\n * @public\n */\nexport function useSite(): string { return "" }',
      'app/composables/useCategories.ts': '/** The list.\n * @public\n */\nexport function useCategories(): string[] { return [] }',
      'app/helpers/categories.ts': '/** Its color.\n * @public\n */\nexport function categoryColor(): string { return "" }',
      'app/interfaces/site.ts': '/** A site.\n * @public\n */\nexport interface Site { name: string }',
      ...extra,
    })) {
      mkdirSync(join(root, file, '..'), { recursive: true })
      writeFileSync(join(root, file), text)
    }
    return root
  }

  it('renders every group', () => {
    const sections = slotApiSections(project())
    expect(sections).toHaveLength(3)
    expect(sections.join('\n')).toContain('export function useSite(): string')
  })

  it('fails on a group without a public declaration', () => {
    const root = project({ 'app/composables/useSite.ts': 'export function useSite(): string { return "" }' })
    expect(() => slotApiSections(root)).toThrow('has no @public declaration')
  })

  it('also finds the tag in .vue and .mjs files', () => {
    const root = project({ 'modules/theme/x.mjs': '// @public', 'app/components/X.vue': '<script>/** @public */</script>' })
    expect(unlistedPublicFiles(root)).toEqual(['app/components/X.vue', 'modules/theme/x.mjs'])
  })

  it('fails on a public declaration that no group lists', () => {
    const root = project({ 'app/helpers/other.ts': '/** Extra.\n * @public\n */\nexport function extra(): void {}' })
    expect(unlistedPublicFiles(root)).toEqual(['app/helpers/other.ts'])
    expect(() => slotApiSections(root)).toThrow('app/helpers/other.ts')
  })
})
