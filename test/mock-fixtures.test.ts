import { describe, expect, it } from 'vitest'
import { ITEM_FIELDS, withIds } from '../e2e/fixtures/ids.mjs'
import { pageFixtures } from '../e2e/fixtures/pages.mjs'

interface Block { __component: string, blockId?: unknown, [field: string]: unknown }

describe('the page fixtures of the mock Strapi', () => {
  it('every block of e2e/fixtures/pages.mjs has a blockId and every repeatable item an itemId', () => {
    expect(pageFixtures.length).toBeGreaterThan(0)
    for (const page of pageFixtures) {
      const sections = page.sections as Block[]
      const blockIds = sections.map(section => section.blockId)
      for (const section of sections) {
        expect(typeof section.blockId, `${page.slug} ${section.__component}`).toBe('string')
        expect(section.blockId).not.toBe('')
        const field = ITEM_FIELDS[section.__component as keyof typeof ITEM_FIELDS]
        if (!field) continue
        const items = section[field] as Array<{ itemId?: unknown }>
        const itemIds = items.map(item => item.itemId)
        expect(itemIds.every(id => typeof id === 'string' && id !== ''), `${page.slug} ${section.__component} ${field}`).toBe(true)
        expect(new Set(itemIds).size, `the itemIds of ${page.slug} ${section.__component}`).toBe(itemIds.length)
      }
      expect(new Set(blockIds).size, `the blockIds of ${page.slug}`).toBe(blockIds.length)
    }
  })

  it('names every repeatable item field of the blocks the pages carry', () => {
    const fields = new Set<string>()
    for (const page of pageFixtures) {
      for (const section of page.sections as Block[]) {
        for (const [field, value] of Object.entries(section)) {
          if (Array.isArray(value) && value.some(item => item && typeof item === 'object' && 'itemId' in item)) fields.add(`${section.__component}.${field}`)
        }
      }
    }
    expect([...fields].sort()).toEqual(Object.entries(ITEM_FIELDS).filter(([component]) => component !== 'shared.slider').map(([component, field]) => `${component}.${field}`).sort())
  })

  it('withIds keeps an id it finds and gives the others one unique in the zone', () => {
    const [kept, given] = withIds([{ __component: 'section.stats', blockId: 'mine', items: [{ itemId: 'its', value: '1' }, { value: '2' }] }, { __component: 'section.cta' }], 'z') as Block[]
    expect(kept!.blockId).toBe('mine')
    expect((kept!.items as Array<{ itemId: string }>).map(item => item.itemId)).toEqual(['its', 'mine-i2'])
    expect(given!.blockId).toBe('z-b2')
  })
})
