import { z } from 'zod'
import type { CategoryCount } from '~/interfaces/design'
import type { TagCount } from '~/interfaces/strapi-post'
import { responseSchema } from './response'

/** A category with the number of posts in it (`GET /api/categories`). */
export const categoryCountSchema = responseSchema<CategoryCount>()(
  z.strictObject({ id: z.int(), slug: z.string().nullable(), name: z.string(), count: z.int().min(0) }).meta({ id: 'CategoryCount', description: 'A category with the number of posts in it.' }),
)

/** A tag with the number of its articles in one locale (`GET /api/tags`). */
export const tagCountSchema = responseSchema<TagCount>()(
  z.strictObject({ slug: z.string(), name: z.string(), count: z.int().min(1) }).meta({ id: 'TagCount', description: 'A tag with the number of its articles in the requested locale; tags with none are left out.' }),
)
