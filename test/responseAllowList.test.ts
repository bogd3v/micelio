import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { fields, variants } from '~/helpers/allowList'
import type { Shape } from '~/helpers/allowList'
import { aboutSchema, strapiBlockSchema } from '~/schemas/blocks'
import { articleSchema } from '~/schemas/posts'
import { aboutShape, articleShape, cardShape } from '../server/lib/publicShapes'

// The allow-list decides what a route sends and the schema describes it; this walks both so a key added to one and not the other fails here

interface ZodNode {
  _zod: {
    def: {
      type: string
      innerType?: ZodNode
      element?: ZodNode
      options?: ZodNode[]
      shape?: Record<string, ZodNode>
    }
  }
}

function define(schema: unknown): ZodNode['_zod']['def'] {
  return (schema as ZodNode)._zod.def
}

function unwrap(schema: ZodNode): ZodNode {
  const def = define(schema)
  if ((def.type === 'optional' || def.type === 'nullable') && def.innerType) return unwrap(def.innerType)
  return schema
}

/** The paths where `shape` lets a key through that `schema` does not describe. */
function missing(shape: Shape, schema: z.ZodType, path: string): string[] {
  if (shape === true) return []
  const node = unwrap(schema as unknown as ZodNode)
  const def = define(node)
  if (shape.kind === 'each') {
    return def.type === 'array' && def.element ? missing(shape.item, def.element as unknown as z.ZodType, `${path}[]`) : [`${path} is not an array`]
  }
  if (shape.kind === 'variants') {
    if (def.type !== 'union' || !def.options) return [`${path} is not a union`]
    return Object.entries(shape.cases).flatMap(([name, caseShape]) => {
      const option = def.options!.find(candidate => (define(candidate).shape?.[shape.key] as unknown as { _zod: { def: { values: string[] } } })?._zod.def.values.includes(name))
      return option ? missing(caseShape, option as unknown as z.ZodType, `${path}<${name}>`) : [`${path}<${name}> has no schema`]
    })
  }
  const known = def.shape
  if (!known) return [`${path} is not an object`]
  return Object.entries(shape.fields).flatMap(([key, fieldShape]) => {
    const field = known[key]
    return field ? missing(fieldShape, field as unknown as z.ZodType, `${path}.${key}`) : [`${path}.${key}`]
  })
}

/** The paths where `schema` lists a key that `shape` never lets through, one level deep. */
function unsent(shape: Shape, schema: z.ZodType): string[] {
  if (shape === true || shape.kind !== 'fields') return []
  return Object.keys(define(unwrap(schema as unknown as ZodNode)).shape ?? {}).filter(key => !(key in shape.fields))
}

describe('response schemas follow the allow-lists of publicShapes', () => {
  it('describe every key an article, a card and the About page may carry', () => {
    expect(missing(articleShape, articleSchema, 'article')).toEqual([])
    expect(missing(cardShape, articleSchema, 'card')).toEqual([])
    expect(missing(aboutShape, aboutSchema, 'about')).toEqual([])
  })

  it('list only the known keys the routes never send', () => {
    expect(unsent(articleShape, articleSchema)).toEqual(['content', 'createdAt'])
    expect(unsent(cardShape, articleSchema).sort()).toEqual(['blocks', 'content', 'coverCredit', 'createdAt', 'localizations', 'references', 'updatedAt'])
    const seo = (define(unwrap(articleSchema as unknown as ZodNode)).shape as Record<string, ZodNode>).seo as unknown as z.ZodType
    expect(unsent((articleShape as { fields: Record<string, Shape> }).fields.seo!, seo).sort()).toEqual(['metaSocial', 'metaViewport'])
  })

  it('lists no key of the About page that the route never sends', () => {
    expect(unsent(aboutShape, aboutSchema)).toEqual([])
  })

  it('notice a key the schema lacks', () => {
    expect(missing(fields({ title: true, unknownKey: true }), articleSchema, 'article')).toEqual(['article.unknownKey'])
    expect(missing(variants('__component', { 'shared.quote': fields({ nope: true }), 'shared.unknown': fields({}) }), strapiBlockSchema, 'block')).toEqual(['block<shared.quote>.nope', 'block<shared.unknown> has no schema'])
  })
})
