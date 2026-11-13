import { describe, expect, it } from 'vitest'
import { ITEM_FIELDS, withIds } from '../e2e/fixtures/ids.mjs'
import { blockValueCases, blockValueKey, pageFixtures } from '../e2e/fixtures/pages.mjs'
import { BLOCK_EXPOSES, BLOCK_OPTIONS } from '../app/interfaces/block-options'

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

  it('blockValueCases has every value of tone and align for each page section that offers them', () => {
    // The table spans the pages the cases name: a page resolves only four post lists, so the post list's values have a second one
    const slugs = new Set(blockValueCases.map(([, , , slug]) => (slug as string | undefined) ?? 'block-options'))
    const sections = pageFixtures.filter(candidate => slugs.has(candidate.slug)).flatMap(candidate => candidate.sections as Block[])
    const keys = blockValueCases.filter(([, , saved]) => !saved).map(([block, options]) => blockValueKey(block as string, options as Record<string, string>))
    const titled = (title: string): Block[] => sections.filter(section => section.title === title || (typeof section.body === 'string' && section.body.startsWith(`## ${title}\n`)))
    // The server resolves the posts of a page's first four post lists (MAX_POST_LISTS of server/utils/pageSections.ts); the rest render nothing
    for (const candidate of pageFixtures.filter(each => slugs.has(each.slug))) {
      expect((candidate.sections as Block[]).filter(section => section.__component === 'section.post-list').length, candidate.slug).toBeLessThanOrEqual(4)
    }
    const seen = new Map<string, Set<string>>()
    for (const key of keys) {
      for (const section of titled(key)) {
        for (const name of ['tone', 'align'] as const) {
          if (typeof section[name] === 'string') seen.set(`${section.__component} ${name}`, new Set([...(seen.get(`${section.__component} ${name}`) ?? []), section[name] as string]))
        }
      }
    }
    // Each section of the page catalogue that offers an option, less the one whose variant offers it only in the other (a background scene)
    for (const [uid, exposed] of Object.entries(BLOCK_EXPOSES)) {
      if (!uid.startsWith('section.')) continue
      for (const name of ['tone', 'align'] as const) {
        const offered = (exposed as readonly string[]).includes(name)
        expect(offered, `${uid} offers ${name}`).toBe(true)
        // The default value is the plain twin's: every other value has its own section
        const others = BLOCK_OPTIONS[name].values.filter(value => value !== BLOCK_OPTIONS[name].default)
        expect([...(seen.get(`${uid} ${name}`) ?? [])].sort(), `${uid} ${name}`).toEqual([...others].sort())
      }
    }
    // A background scene has none of either: the plugin refuses them there
    for (const section of sections.filter(candidate => candidate.__component === 'section.scene' && candidate.variant === 'background')) {
      expect(section, String(section.title)).not.toHaveProperty('tone')
      expect(section, String(section.title)).not.toHaveProperty('align')
    }
  })
})
