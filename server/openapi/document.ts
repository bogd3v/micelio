import { z } from 'zod'
import { SESSION_COOKIE } from '../../app/constants/auth'
import { PROBLEM_CODES } from '../utils/problem'
import type { HttpMethod, JsonSchema, ParameterLocation, ParameterSpec, RouteEntry } from './types'

/** The OpenAPI version the document declares. */
const OPENAPI_VERSION = '3.1.0'

/** Placeholder for the server URL: the API is served by the site itself, and the core names no site (standard, principle 2). */
export const PLACEHOLDER_SERVER_URL = 'https://example.com'

const PROBLEM_MEDIA_TYPE = 'application/problem+json'
const JSON_MEDIA_TYPE = 'application/json'
const DEFS_PREFIX = '#/$defs/'
const COMPONENTS_PREFIX = '#/components/schemas/'
const METHOD_ORDER: HttpMethod[] = ['get', 'post', 'delete']
const TAG_DESCRIPTIONS: Record<string, string> = {
  'Account': 'Sign-in, registration, passwords and the profile. Needs the accounts module.',
  'Comments': 'Guest comments on articles. Needs the comments module.',
  'Content': 'The blog content, the CMS pages and the site identity.',
  'Drafts': 'Unpublished articles, for editors only. Needs the drafts module.',
  'Fediverse': 'Reactions from the fediverse. Needs the fediverse module.',
  'Newsletter': 'Subscription by email. Needs the newsletter module.',
  'Site files': 'RSS feeds, the sitemap and robots.txt, served outside `/api`.',
}

/** A document the generator produced: OpenAPI 3.1 as plain JSON. */
export type OpenApiDocument = Record<string, unknown>

const PROBLEM_SCHEMA: JsonSchema = {
  type: 'object',
  description: 'A problem detail (RFC 9457) as Micelio sends it. A client branches on `code`, never on the text. The Nitro members stay for one release line (ADR 0015).',
  required: ['type', 'title', 'status', 'detail', 'code'],
  properties: {
    type: { type: 'string', const: 'about:blank' },
    title: { type: 'string', description: 'The status phrase.' },
    status: { type: 'integer' },
    detail: { type: 'string', description: 'A fixed English text for developers, never upstream text.' },
    code: { type: 'string', enum: Object.keys(PROBLEM_CODES).sort() },
    statusCode: { type: 'integer', deprecated: true, description: 'Legacy Nitro member, equal to `status`.' },
    statusMessage: { type: 'string', deprecated: true, description: 'Legacy Nitro member.' },
    message: { type: 'string', deprecated: true, description: 'Legacy Nitro member.' },
    data: { type: 'object', deprecated: true, description: 'Legacy Nitro member; `data.code` equals `code`.' },
  },
}

/**
 * Builds the OpenAPI 3.1 document of the site API from the route manifest and the zod schemas.
 *
 * @remarks
 * Pure and deterministic: paths and tags are sorted, so the same input gives the same text. Query, path and body schemas are read as input with `z.toJSONSchema`; a response with a `schema` is read as output and referenced from `components.schemas` (the `id` in its `.meta`), and one without it is described by status and media type, naming the TypeScript type of the body. Errors are `application/problem+json` (ADR 0015).
 *
 * @param version - The version the document declares, normally the `version` of `package.json`.
 * @param routes - The route manifest.
 */
export function buildOpenApiDocument(version: string, routes: RouteEntry[]): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {}
  const schemas: Record<string, JsonSchema> = {}
  for (const route of [...routes].sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method))) {
    paths[route.path] = { ...paths[route.path], [route.method]: operationOf(route, schemas) }
  }
  const tags = [...new Set(routes.map(route => route.tag))].sort().map(name => ({ name, description: TAG_DESCRIPTIONS[name] ?? name }))
  const operations = routes.length
  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: 'Micelio site API',
      version,
      description: `The HTTP routes every Micelio site serves: ${Object.keys(paths).length} paths and ${operations} operations, from \`server/api\` and \`server/routes\`. Generated from \`server/openapi/\` and the zod schemas of \`server/schemas/\`; do not edit by hand. Errors under \`/api\` are problem details (RFC 9457). Response bodies with a schema are in \`components.schemas\`; the others are described by status and media type, naming their TypeScript type in \`app/interfaces\`.`,
      license: { name: 'AGPL-3.0-only', identifier: 'AGPL-3.0-only' },
    },
    servers: [{ url: PLACEHOLDER_SERVER_URL, description: 'Your site. The API is served from the same origin as the pages.' }],
    tags,
    paths: Object.fromEntries(sortedEntries(paths)),
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: SESSION_COOKIE,
          description: 'The session set by sign-in: HttpOnly, Secure, SameSite=Lax. Browsers send it; clients outside a browser rarely need it.',
        },
      },
      schemas: Object.fromEntries(sortedEntries({ Problem: PROBLEM_SCHEMA, ...schemas })),
    },
  }
}

/** The text of the document as it is written to `docs/openapi.json`: two-space JSON with a trailing newline. */
export function renderOpenApiDocument(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

/**
 * The `operationId` of a route: the method and the path segments in camelCase, a `{param}` as `By<Param>`.
 *
 * @internal
 */
export function operationId(method: HttpMethod, path: string): string {
  const words = path.split('/').filter(Boolean).flatMap((segment) => {
    const param = /^\{(\w+)\}$/.exec(segment)
    return (param ? ['by', param[1]!] : segment.split(/[^A-Za-z0-9]+/)).filter(Boolean)
  })
  return method + words.map(word => word[0]!.toUpperCase() + word.slice(1)).join('')
}

function sortedEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

function jsonSchemaOf(schema: z.ZodType): JsonSchema {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema
  return rest
}

function parametersOf(route: RouteEntry): Record<string, unknown>[] {
  const specs = route.parameters ?? []
  const used = new Set<ParameterSpec>()
  const fromSchema = (schema: z.ZodType | undefined, location: ParameterLocation): Record<string, unknown>[] => {
    if (!schema) return []
    const json = jsonSchemaOf(schema)
    const required = new Set((json.required as string[] | undefined) ?? [])
    return Object.entries((json.properties ?? {}) as Record<string, JsonSchema>).map(([name, property]) => {
      const spec = specs.find(candidate => candidate.name === name && candidate.in === location)
      if (spec) used.add(spec)
      return {
        name,
        in: location,
        ...(spec?.description && { description: spec.description }),
        required: location === 'path' || required.has(name),
        schema: spec?.schema ?? property,
      }
    })
  }
  const derived = [...fromSchema(route.params, 'path'), ...fromSchema(route.query, 'query')]
  const extra = specs.filter(spec => !used.has(spec)).map(spec => ({
    name: spec.name,
    in: spec.in,
    description: spec.description,
    required: spec.in === 'path' || spec.required === true,
    schema: spec.schema ?? { type: 'string' },
  }))
  return [...derived, ...extra].sort((a, b) => Number(b.in === 'path') - Number(a.in === 'path'))
}

/** The JSON Schema of a response body as the route sends it; the named schemas it uses go into `components`, and a name that two different schemas claim is an error. */
function responseSchemaOf(schema: z.ZodType, components: Record<string, JsonSchema>): JsonSchema {
  // `$defs` holds the schemas that have a `.meta({ id })`; one without an id would come out as a generated `__schemaN`, so every response schema needs its own id.
  // The refs are rewritten on the serialized text because they can sit at any depth.
  const { $schema: _dialect, $defs, ...body } = z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' }) as JsonSchema & { $defs?: Record<string, JsonSchema> }
  for (const [name, definition] of Object.entries($defs ?? {})) {
    const rewritten = JSON.parse(JSON.stringify(definition).replaceAll(DEFS_PREFIX, COMPONENTS_PREFIX)) as JsonSchema
    if (name === 'Problem' || (components[name] && JSON.stringify(components[name]) !== JSON.stringify(rewritten))) {
      throw new Error(`Two different response schemas are named ${name}; give each its own \`.meta({ id })\`.`)
    }
    components[name] = rewritten
  }
  return JSON.parse(JSON.stringify(body).replaceAll(DEFS_PREFIX, COMPONENTS_PREFIX)) as JsonSchema
}

function successResponse(route: RouteEntry, components: Record<string, JsonSchema>): Record<string, unknown> {
  const { response } = route
  const contentType = response.contentType ?? JSON_MEDIA_TYPE
  const typeNote = response.type && !response.schema ? ` Body: \`${response.type}\` (\`app/interfaces\`).` : ''
  const cacheNote = response.cache ? ` Cache-Control: \`${response.cache}\`.` : ''
  const description = `${response.description}${typeNote}${cacheNote}`
  const schema: JsonSchema = response.schema ? responseSchemaOf(response.schema, components) : contentType === JSON_MEDIA_TYPE ? { description: response.type ? `The TypeScript type ${response.type}.` : 'An object.' } : { type: 'string' }
  return { description, content: { [contentType]: { schema } } }
}

function errorResponses(codes: RouteEntry['errors'], details: RouteEntry['errorDetails'] = {}): [string, Record<string, unknown>][] {
  const byStatus = new Map<number, ProblemCode[]>()
  for (const code of [...new Set(codes)].sort()) {
    const status = PROBLEM_CODES[code].status
    byStatus.set(status, [...(byStatus.get(status) ?? []), code])
  }
  return [...byStatus.entries()].sort(([a], [b]) => a - b).map(([status, statusCodes]) => {
    const lines = statusCodes.map(code => `- \`${code}\`: ${details[code] ?? PROBLEM_CODES[code].detail}`)
    const response: Record<string, unknown> = {
      description: `${PROBLEM_CODES[statusCodes[0]!].title}. The \`code\` is one of:\n${lines.join('\n')}`,
      content: {
        [PROBLEM_MEDIA_TYPE]: {
          schema: { allOf: [{ $ref: '#/components/schemas/Problem' }, { type: 'object', properties: { code: { enum: statusCodes } } }] },
        },
      },
    }
    if (status === 429) {
      response.headers = { 'Retry-After': { description: 'Seconds to wait before trying again, when the limit says.', required: false, schema: { type: 'integer', minimum: 0 } } }
    }
    return [String(status), response]
  })
}

function defaultResponse(): Record<string, unknown> {
  return {
    description: 'Any other error, usually a 500 `internalError` or a 405 `methodNotAllowed`.',
    content: { [PROBLEM_MEDIA_TYPE]: { schema: { $ref: '#/components/schemas/Problem' } } },
  }
}

function requestBodyOf(route: RouteEntry): Record<string, unknown> | undefined {
  const schema = route.body ? jsonSchemaOf(route.body) : route.bodySchema
  if (!schema) return undefined
  return { required: !route.bodyOptional, content: { [JSON_MEDIA_TYPE]: { schema } } }
}

function operationOf(route: RouteEntry, components: Record<string, JsonSchema>): Record<string, unknown> {
  const parameters = parametersOf(route)
  const requestBody = requestBodyOf(route)
  const sessionSecurity = route.session === 'required'
    ? [{ sessionCookie: [] }]
    : route.session === 'optional' ? [{}, { sessionCookie: [] }] : undefined
  return {
    operationId: operationId(route.method, route.path),
    summary: route.summary,
    ...(route.description && { description: route.description }),
    tags: [route.tag],
    ...(parameters.length > 0 && { parameters }),
    ...(requestBody && { requestBody }),
    ...(sessionSecurity && { security: sessionSecurity }),
    responses: Object.fromEntries([
      [String(route.response.status), successResponse(route, components)],
      ...errorResponses(route.errors, route.errorDetails),
      ...(route.path.startsWith('/api/') ? [['default', defaultResponse()]] : []),
    ]),
  }
}
