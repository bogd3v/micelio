import { z } from 'zod'
import { responseSchema } from './response'

interface Pair { a: string, b: number | null }

/**
 * Negative type cases of `responseSchema`, checked by `npm run typecheck` because the tests are not.
 *
 * @remarks
 * Never called and imported by nothing, so it has no runtime effect and is not in any bundle. Each `@ts-expect-error` must keep failing: when the helper stops rejecting drift, the unused directive fails the type check.
 */
export function responseSchemaRejectsDrift(): void {
  responseSchema<Pair>()(z.strictObject({ a: z.string(), b: z.number().nullable() }))
  // @ts-expect-error the schema lacks the nullable `b`
  responseSchema<Pair>()(z.strictObject({ a: z.string(), b: z.number() }))
  // @ts-expect-error the schema has a field the interface does not
  responseSchema<Pair>()(z.strictObject({ a: z.string(), b: z.number().nullable(), c: z.string() }))
  // @ts-expect-error the schema lacks a field of the interface
  responseSchema<Pair>()(z.strictObject({ a: z.string() }))
}
