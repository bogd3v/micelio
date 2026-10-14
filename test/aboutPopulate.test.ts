import qs from 'qs'
import { describe, expect, it } from 'vitest'
import type { Shape } from '../app/helpers/allowList'
import { ABOUT_POPULATE } from '../server/lib/constants'
import { aboutBlocks } from '../server/lib/publicShapes'

const image = { fields: ['url', 'alternativeText', 'caption', 'width', 'height'] }

/** The keys of an object shape whose value is not a scalar: the nested components and images Strapi needs a populate for. */
function nestedKeys(shape: Shape): string[] {
  const inner = typeof shape === 'object' && shape.kind === 'each' ? shape.item : shape
  if (typeof inner !== 'object' || inner.kind !== 'fields') return []
  return Object.entries(inner.fields).filter(([, value]) => value !== true).map(([key]) => key)
}

function fieldShape(shape: Shape, key: string): Shape {
  const inner = typeof shape === 'object' && shape.kind === 'each' ? shape.item : shape
  if (typeof inner !== 'object' || inner.kind !== 'fields') throw new Error(`no fields in the shape of ${key}`)
  return inner.fields[key]!
}

describe('ABOUT_POPULATE', () => {
  it('never asks Strapi to populate everything', () => {
    expect(qs.stringify({ populate: ABOUT_POPULATE })).not.toContain('*')
    expect(JSON.stringify(ABOUT_POPULATE)).not.toContain('"*"')
  })

  it('populates every nested field of every About block that the allow-list keeps', () => {
    const on = ABOUT_POPULATE.blocks.on as Record<string, unknown>
    for (const [component, shape] of Object.entries(aboutBlocks)) {
      const nested = nestedKeys(shape)
      const entry = on[component]
      if (nested.length === 0) {
        expect(entry, `${component} has no nested field, so it is populated with true`).toBe(true)
        continue
      }
      const populate = (entry as { populate?: Record<string, unknown> } | undefined)?.populate
      expect(populate, `${component} needs a populate for ${nested.join(', ')}`).toBeDefined()
      for (const key of nested) expect(Object.keys(populate!), `${component}.${key}`).toContain(key)
    }
  })

  it('populates the facts, stack and links of every project', () => {
    const nested = nestedKeys(fieldShape(aboutBlocks['about.projects']!, 'projects'))
    expect(nested.sort()).toEqual(['facts', 'links', 'stack'])
    const projects = (ABOUT_POPULATE.blocks.on['about.projects'] as { populate: { projects: { populate: Record<string, unknown> } } }).populate.projects
    for (const key of nested) expect(Object.keys(projects.populate), `projects.${key}`).toContain(key)
  })

  it('asks only for the image fields a page reads and for the credit of every figure', () => {
    const on = ABOUT_POPULATE.blocks.on
    expect(on['about.profile'].populate.photo).toEqual(image)
    expect(on['shared.media']).toEqual({ populate: { file: image, credit: true } })
    expect(on['shared.slider']).toEqual({ populate: { items: { populate: { file: image, credit: true } }, files: image } })
    expect(ABOUT_POPULATE.seo).toEqual({ populate: { metaImage: image } })
  })
})
