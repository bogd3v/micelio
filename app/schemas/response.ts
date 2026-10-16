import type { z } from 'zod'

type Same<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false

/** Resolves to `unknown` when the schema's output type is exactly `T`; otherwise to an object no schema satisfies, which makes the call fail to type-check. */
type MustMatch<S extends z.ZodType, T> = Same<z.output<S>, T> extends true ? unknown : { readonly 'the schema and the interface differ': { schema: z.output<S>, interface: T } }

/**
 * Ties a response schema to the interface that is the source of truth, so either one changing alone fails `npm run typecheck`.
 *
 * @remarks
 * Call it as `responseSchema<Interface>()(z.strictObject({ ... }))`. The schema must produce exactly `Interface` (checked in both directions, optional and nullable fields included). It describes what the route sends, and is read by server code and tests only, never by components. Build objects with `z.strictObject`, so parsing rejects an extra key like the published `additionalProperties: false`; a shape that passes Strapi fields through unchanged uses `z.looseObject` on purpose, or stays strict when the CMS builds the shape field by field and its response-fields check pins the keys (the flat comments envelope, the draft rows). Give every schema its own `.meta({ id: 'Interface' })` so the OpenAPI document names it under `components.schemas`.
 *
 * @returns A function that takes the schema and returns it unchanged.
 */
export function responseSchema<T>(): <S extends z.ZodType<T>>(schema: S & MustMatch<S, T>) => S {
  return schema => schema
}
