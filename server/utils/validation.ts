import type { H3Event } from 'h3'
import type { z } from 'zod'

/** The largest request body a route reads: the biggest legitimate one is a comment (5000 characters, a few bytes each) with its author, far under this. */
export const MAX_BODY_BYTES = 64 * 1024

function payloadTooLarge(event: H3Event): Error {
  // The rest of the body is not read, so the connection cannot carry another request
  setResponseHeader(event, 'connection', 'close')
  return createError({ statusCode: 413, statusMessage: 'Payload Too Large' })
}

/**
 * The raw body of a request, never holding more than `maxBytes` of it.
 *
 * @remarks
 * A body whose declared `content-length` is over the cap, or whose bytes pass it while they arrive (a chunked body has no length), is a 413 and the rest is not read.
 *
 * @throws a 413 error when the body is over `maxBytes`.
 */
export async function readLimitedRaw(event: H3Event, maxBytes = MAX_BODY_BYTES): Promise<Buffer> {
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw payloadTooLarge(event)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of event.node.req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > maxBytes) {
      event.node.req.pause()
      throw payloadTooLarge(event)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Reads the body of a request within the cap and parses it as JSON or as a form.
 *
 * @remarks
 * An empty or unparsable body is `undefined`. A `application/x-www-form-urlencoded` body (the one-click unsubscribe of mail providers) becomes an object of its fields.
 *
 * @throws a 413 error when the body is over `maxBytes` (see `readLimitedRaw`).
 */
export async function readLimitedBody(event: H3Event, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const text = (await readLimitedRaw(event, maxBytes)).toString('utf8')
  if (!text) return undefined
  if (String(getRequestHeader(event, 'content-type')).includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text))
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Reads the JSON body of a request and validates it against `schema`.
 *
 * @remarks
 * A body that is missing, is not JSON or is not an object is validated as an empty object, so the schema decides. A failing body throws the error that `invalid` builds, so each route sets its own status and code.
 */
export async function validBody<Schema extends z.ZodType>(event: H3Event, schema: Schema, invalid: (error: z.ZodError) => Error): Promise<z.output<Schema>> {
  let body: unknown
  try {
    body = await readLimitedBody(event)
  } catch (error: unknown) {
    // Too large is not "no body": the route must not go on
    if ((error as { statusCode?: number }).statusCode === 413) throw error
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
