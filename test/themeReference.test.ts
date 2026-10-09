import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import { SLOT_SPECS } from '../modules/theme/data'
import { LAYOUT_REGIONS, SLOT_NAMES } from '../modules/theme/constants'
import { REGION_VARIANTS, VARIANT_DESCRIPTIONS } from '../modules/theme/layout/variants'
import { OPTIONAL_ROLES, REQUIRED_ROLES, ROLE_PURPOSES } from '../modules/theme/roles.mjs'

interface DeclaredProp {
  name: string
  optional: boolean
  /** Type text, for `defineProps<{}>` slots only. */
  type?: string
}

function declaredProps(slot: string): DeclaredProp[] {
  const source = readFileSync(fileURLToPath(new URL(`../app/theme/defaults/${slot}.vue`, import.meta.url)), 'utf8')
  const { descriptor } = parse(source)
  const script = `${descriptor.scriptSetup?.content ?? ''}\n${descriptor.script?.content ?? ''}`
  const generic = /defineProps<\{([\s\S]*?)\n\}>\(\)/.exec(script)
  if (generic) return [...generic[1]!.matchAll(/^\s*(\w+)(\?)?:\s*(.+)$/gm)].map(([, name, optional, type]) => ({ name: name!, optional: Boolean(optional), type: type!.trim().replace(/\s+/g, ' ') }))
  const options = /props:\s*\{([\s\S]*?)\n {2}\},/.exec(script)
  if (options) return [...options[1]!.matchAll(/^ {4}(\w+): \{([^\n]*)\}/gm)].map(([, name, body]) => ({ name: name!, optional: !body!.includes('required: true') }))
  return []
}

describe('theme reference sources', () => {
  it('has a purpose for every role and no extra keys', () => {
    const roles = [...Object.values(REQUIRED_ROLES).flat(), ...Object.values(OPTIONAL_ROLES).flatMap(group => Object.keys(group))]
    expect(Object.keys(ROLE_PURPOSES).sort()).toEqual([...roles].sort())
    for (const purpose of Object.values(ROLE_PURPOSES)) expect(purpose.length).toBeGreaterThan(0)
  })

  it('has a spec for every slot and no extra', () => {
    expect(Object.keys(SLOT_SPECS).sort()).toEqual([...SLOT_NAMES].sort())
  })

  it.each([...SLOT_NAMES])('%s props match its core default', (slot) => {
    const declared = declaredProps(slot)
    const spec = SLOT_SPECS[slot].props.map(({ name, optional, type }, index) => ({ name, optional, ...(declared[index]?.type ? { type } : {}) }))
    expect(spec).toEqual(declared)
  })

  it('describes every slot prop', () => {
    for (const slot of SLOT_NAMES) for (const prop of SLOT_SPECS[slot].props) expect(prop.description.length).toBeGreaterThan(0)
  })

  it('describes every variant of every region', () => {
    for (const region of LAYOUT_REGIONS) {
      expect(Object.keys(VARIANT_DESCRIPTIONS[region]).sort()).toEqual([...REGION_VARIANTS[region].variants].sort())
    }
  })
})
