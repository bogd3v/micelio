import type { H3Event } from 'h3'
import type { z } from 'zod'

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

export function validQuery<Schema extends z.ZodType>(event: H3Event, schema: Schema, invalid: (error: z.ZodError) => Error = invalidQuery): z.output<Schema> {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) throw invalid(result.error)
  return result.data
}

export function invalidQuery(error: z.ZodError): Error {
  return createError({ statusCode: 400, statusMessage: error.issues[0]?.message ?? 'Invalid query' })
}
