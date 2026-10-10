import type { H3Event } from 'h3'
import type { z } from 'zod'

/**
 * Reads the JSON body of a request and validates it against `schema`.
 *
 * @remarks
 * A body that is missing, is not JSON or is not an object is validated as an empty object, so the schema decides. A failing body throws the error that `invalid` builds, so each route sets its own status and code.
 */
export async function validBody<Schema extends z.ZodType>(event: H3Event, schema: Schema, invalid: (error: z.ZodError) => Error): Promise<z.output<Schema>> {
  let body: unknown
  try {
    body = await readBody<unknown>(event)
  } catch {
    body = null
  }
  const result = schema.safeParse(body && typeof body === 'object' ? body : {})
  if (!result.success) throw invalid(result.error)
  return result.data
}

/**
 * Validates the query string of a request against `schema` and returns the parsed data.
 *
 * @remarks
 * A failing query throws the error that `invalid` builds; by default that is `invalidQuery`.
 */
export function validQuery<Schema extends z.ZodType>(event: H3Event, schema: Schema, invalid: (error: z.ZodError) => Error = invalidQuery): z.output<Schema> {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) throw invalid(result.error)
  return result.data
}

/** The 400 error of a query that fails its schema, with the message of the first issue as the status message. */
export function invalidQuery(error: z.ZodError): Error {
  return createError({ statusCode: 400, statusMessage: error.issues[0]?.message ?? 'Invalid query' })
}
