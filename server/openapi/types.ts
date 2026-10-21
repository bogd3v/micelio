import type { z } from 'zod'
import type { ProblemCode } from '../utils/problem'

/** A JSON Schema fragment as `z.toJSONSchema` produces it or as a manifest entry writes it by hand. */
export type JsonSchema = Record<string, unknown>

/** The HTTP methods the routes of `server/api` and `server/routes` use. */
export type HttpMethod = 'get' | 'post' | 'delete'

/** Where an OpenAPI parameter is sent. */
export type ParameterLocation = 'query' | 'path'

/** What the manifest says about one parameter: its description and, when no zod schema covers it, its type. */
export interface ParameterSpec {
  name: string
  in: ParameterLocation
  description: string
  /** Replaces the schema derived from zod, which is empty for a field typed `unknown`; also the type of a parameter no schema covers. */
  schema?: JsonSchema
  /** Only for a parameter no schema covers; the zod schema says it for the rest. Path parameters are always required. */
  required?: boolean
}

/** The successful answer of a route. */
export interface SuccessResponse {
  status: 200 | 201
  /** The media type of the body; JSON when absent. */
  contentType?: 'application/json' | 'application/xml' | 'application/rss+xml' | 'text/plain' | 'application/octet-stream'
  /**
   * The zod schema of the JSON body as the route sends it, read as output.
   *
   * @remarks
   * Tied to its interface in `app/schemas/` (`responseSchema`). Each schema with a `.meta({ id })` becomes an entry of `components.schemas` that the operation references. Wins over `type`.
   */
  schema?: z.ZodType
  /** The TypeScript type of the body, named in the description for a route that has no `schema` yet. */
  type?: string
  description: string
  /** The `Cache-Control` the route sends, when it is public. */
  cache?: string
}

/** Who may call a route. `optional` serves the visitor with or without a session; `required` answers `unauthorized` or `notFound` without one. */
export type SessionRequirement = 'required' | 'optional'

/** One route file of `server/api` or `server/routes` described for the OpenAPI document. */
export interface RouteEntry {
  /** The route file, relative to the repository root, such as `server/api/about.get.ts`. */
  file: string
  method: HttpMethod
  /** The OpenAPI path, with `{param}` for a route parameter. */
  path: string
  summary: string
  description?: string
  /** The group the operation appears under in a reader. */
  tag: string
  /** The zod schema of the query string, read as input. */
  query?: z.ZodType
  /** The zod schema of the path parameters, read as input. */
  params?: z.ZodType
  /** Descriptions and overrides of parameters, plus the ones no schema covers. */
  parameters?: ParameterSpec[]
  /** The zod schema of the JSON request body. */
  body?: z.ZodType
  /** A request body no zod schema validates, written by hand. */
  bodySchema?: JsonSchema
  /** Whether the body is optional (a token that may also come in the query). */
  bodyOptional?: boolean
  response: SuccessResponse
  /** The problem codes the route can answer; their statuses become the error responses. */
  errors: ProblemCode[]
  /** What a code means on this route, where the catalog text of `server/utils/problem.ts` does not fit it. */
  errorDetails?: Partial<Record<ProblemCode, string>>
  session?: SessionRequirement
}
