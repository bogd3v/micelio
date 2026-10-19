import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate } from '@readme/openapi-parser'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { z } from 'zod'
import type { RouteEntry } from '../server/openapi/types'

type ProblemModule = typeof import('../server/utils/problem')
type DocumentModule = typeof import('../server/openapi/document')
type FilesModule = typeof import('../server/openapi/files')
type ManifestModule = typeof import('../server/openapi/routes')

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VERSION = '0.0.0-test'

interface Operation {
  operationId: string
  requestBody?: { content: Record<string, { schema: Record<string, unknown> }> }
  responses: Record<string, { content?: Record<string, unknown>, headers?: Record<string, unknown> }>
  security?: unknown[]
}
type Paths = Record<string, Record<string, Operation>>

let problem: ProblemModule
let documents: DocumentModule
let files: FilesModule
let manifest: ManifestModule
let built: Record<string, unknown>

beforeAll(async () => {
  vi.stubGlobal('createError', createError)
  problem = await import('../server/utils/problem')
  documents = await import('../server/openapi/document')
  files = await import('../server/openapi/files')
  manifest = await import('../server/openapi/routes')
  built = documents.buildOpenApiDocument(VERSION, manifest.ROUTES)
})

function operations(): [string, string, Operation][] {
  return Object.entries(built.paths as Paths).flatMap(([path, item]) => Object.entries(item).map(([method, operation]): [string, string, Operation] => [method, path, operation]))
}

describe('route manifest', () => {
  it('has an entry for every route file and no entry without one', () => {
    expect(files.routeManifestProblems(ROOT, manifest.ROUTES)).toEqual([])
  })

  it('reports a route file without an entry and an entry without a file', () => {
    const [first, ...rest] = manifest.ROUTES
    const ghost = { ...first!, file: 'server/api/ghost.get.ts' }
    expect(files.routeManifestProblems(ROOT, rest)).toEqual([`${first!.file} has no entry in server/openapi/routes/`])
    expect(files.routeManifestProblems(ROOT, [...manifest.ROUTES, ghost])).toEqual(['server/openapi/routes/ lists server/api/ghost.get.ts, which does not exist'])
  })

  it('names a method in the route file that matches its entry', () => {
    for (const route of manifest.ROUTES) {
      const suffix = /\.(get|post|delete)\.ts$/.exec(route.file)?.[1]
      if (suffix) expect(route.method, route.file).toBe(suffix)
    }
  })

  it('gives every operation a unique id and path parameters that appear in the path', () => {
    const ids = operations().map(([, , operation]) => operation.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const route of manifest.ROUTES) {
      const declared = [...route.path.matchAll(/\{(\w+)\}/g)].map(match => match[1])
      const document = (built.paths as Paths)[route.path]![route.method] as unknown as { parameters?: { name: string, in: string }[] }
      const inPath = (document.parameters ?? []).filter(parameter => parameter.in === 'path').map(parameter => parameter.name)
      expect(inPath.sort(), route.path).toEqual(declared.sort())
    }
  })
})

describe('route manifest against the route sources', () => {
  // What a call in the source implies for the manifest entry, so a protection added to a route cannot go undocumented
  it('declares what the source of each route does', () => {
    for (const route of manifest.ROUTES) {
      const source = readFileSync(join(ROOT, route.file), 'utf8')
      if (/rethrowUpstreamRateLimit|assertRateLimit|strapiAuthFailure/.test(source)) expect(route.errors, `${route.file} can answer 429`).toContain('tooManyRequests')
      if (/assertSameOrigin/.test(source)) expect(route.errors, `${route.file} checks the origin`).toContain('forbiddenOrigin')
      if (/readLimitedBody|validBody/.test(source)) expect(route.errors, `${route.file} reads a body`).toContain('payloadTooLarge')
      if (/getSessionToken|editorSession/.test(source)) expect(route.session, `${route.file} reads the session`).toBeDefined()
    }
  })
})

describe('OpenAPI document', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    const result = await validate(structuredClone(built) as Parameters<typeof validate>[0])
    expect(result.valid ? [] : result.errors).toEqual([])
    expect(built.openapi).toBe('3.1.0')
  })

  it('is deterministic and has sorted paths', () => {
    expect(documents.renderOpenApiDocument(documents.buildOpenApiDocument(VERSION, manifest.ROUTES))).toBe(documents.renderOpenApiDocument(built))
    const paths = Object.keys(built.paths as object)
    expect(paths).toEqual([...paths].sort())
    expect(documents.renderOpenApiDocument(built).endsWith('}\n')).toBe(true)
  })

  it('counts paths and operations in its description and names no site', () => {
    const paths = Object.keys(built.paths as object).length
    const description = (built.info as { description: string }).description
    expect(description).toContain(`${paths} paths and ${operations().length} operations`)
    expect(JSON.stringify(built.servers)).toContain(documents.PLACEHOLDER_SERVER_URL)
    expect(JSON.stringify(built)).not.toMatch(/bogdev/i)
  })

  it('answers every status of the problem codes a route declares, as problem+json', () => {
    for (const route of manifest.ROUTES) {
      const operation = (built.paths as Paths)[route.path]![route.method]!
      for (const code of route.errors) {
        const status = String(problem.PROBLEM_CODES[code].status)
        expect(operation.responses[status], `${route.method} ${route.path} ${status}`).toBeDefined()
        expect(Object.keys(operation.responses[status]!.content ?? {})).toEqual(['application/problem+json'])
        expect(JSON.stringify(operation.responses[status])).toContain(`\`${code}\``)
      }
    }
  })

  it('uses every status of the catalog that some route can answer, and sends Retry-After with 429', () => {
    const used = new Set(manifest.ROUTES.flatMap(route => route.errors.map(code => problem.PROBLEM_CODES[code].status)))
    const documented = new Set(operations().flatMap(([, , operation]) => Object.keys(operation.responses).map(Number)))
    for (const status of used) expect(documented.has(status), String(status)).toBe(true)
    for (const [, , operation] of operations()) {
      if (operation.responses['429']) expect(operation.responses['429'].headers).toHaveProperty('Retry-After')
    }
  })

  it('adds a default problem response to every /api operation and to nothing else', () => {
    for (const [, path, operation] of operations()) {
      const response = operation.responses.default as { content?: Record<string, { schema: unknown }> } | undefined
      if (path.startsWith('/api/')) expect(response?.content?.['application/problem+json']?.schema, path).toEqual({ $ref: '#/components/schemas/Problem' })
      else expect(response, path).toBeUndefined()
    }
  })

  it('lists every catalog code in the Problem schema', () => {
    const schema = (built.components as { schemas: { Problem: { properties: { code: { enum: string[] } } } } }).schemas.Problem
    expect(schema.properties.code.enum).toEqual(Object.keys(problem.PROBLEM_CODES).sort())
  })

  it('takes the request body of every route with a zod body schema from that schema', () => {
    const bodies = manifest.ROUTES.filter(route => route.body)
    expect(bodies.length).toBeGreaterThanOrEqual(8)
    for (const route of bodies) {
      const body = (built.paths as Paths)[route.path]![route.method]!.requestBody
      expect(body?.content['application/json']?.schema, route.path).toMatchObject({ type: 'object' })
    }
    const login = (built.paths as Paths)['/api/auth/login']!.post!.requestBody!.content['application/json']!.schema
    expect(login).toMatchObject({ required: ['identifier', 'password'] })
  })

  it('gives every POST a request body unless it takes none', () => {
    for (const [method, path, operation] of operations()) {
      if (method === 'post' && path !== '/api/auth/logout') expect(operation.requestBody, path).toBeDefined()
    }
  })

  it('requires the session cookie only where a session is needed', () => {
    const secured = operations().filter(([, , operation]) => operation.security).map(([method, path]) => `${method} ${path}`).sort()
    expect(secured).toEqual(['delete /api/auth/me', 'get /api/auth/me', 'get /api/drafts', 'get /api/drafts/{documentId}', 'post /api/auth/change-password'])
    const scheme = (built.components as { securitySchemes: { sessionCookie: { in: string, name: string } } }).securitySchemes.sessionCookie
    expect(scheme).toMatchObject({ in: 'cookie', name: '__Host-micelio_session' })
  })

  it('references every response schema from components.schemas and resolves every $ref', () => {
    const schemas = (built.components as { schemas: Record<string, unknown> }).schemas
    const withSchema = manifest.ROUTES.filter(route => route.response.schema)
    expect(withSchema.length).toBeGreaterThanOrEqual(15)
    const refs = new Set<string>()
    for (const [, , operation] of operations()) {
      for (const match of JSON.stringify(operation).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)) refs.add(match[1]!)
    }
    for (const name of refs) expect(schemas, name).toHaveProperty(name)
    for (const name of ['AuthUserResponse', 'CategoryEntry', 'ConfirmResponse', 'FediverseStats', 'OkResponse', 'SubscribeResponse', 'TagCount', 'UnsubscribeResponse']) expect(refs.has(name), name).toBe(true)
    expect(JSON.stringify(schemas)).not.toContain('#/$defs/')
    expect(JSON.stringify(built)).not.toContain('The TypeScript type SubscribeResponse')
    const response = (built.paths as Paths)['/api/categories']!.get!.responses['200']!.content!['application/json'] as { schema: unknown }
    expect(response.schema).toEqual({ type: 'array', items: { $ref: '#/components/schemas/CategoryEntry' } })
  })

  it('refuses two different response schemas under one name', () => {
    const route = (schema: z.ZodType): RouteEntry => ({ file: 'server/api/x.get.ts', method: 'get', path: '/api/x', summary: 's', tag: 'T', response: { status: 200, schema, description: 'd' }, errors: [] })
    const one = z.object({ a: z.string() }).meta({ id: 'Clash' })
    const other = z.object({ b: z.string() }).meta({ id: 'Clash' })
    expect(() => documents.buildOpenApiDocument(VERSION, [route(one), { ...route(other), path: '/api/y' }])).toThrow(/named Clash/)
  })

  it('describes the feeds, sitemap and robots.txt as text', () => {
    const paths = built.paths as Paths
    expect(Object.keys(paths['/feed.xml']!.get!.responses['200']!.content!)).toEqual(['application/rss+xml'])
    expect(Object.keys(paths['/sitemap.xml']!.get!.responses['200']!.content!)).toEqual(['application/xml'])
    expect(Object.keys(paths['/robots.txt']!.get!.responses['200']!.content!)).toEqual(['text/plain'])
  })

  it('describes the token error of each newsletter route as the route answers it', () => {
    const paths = built.paths as Paths
    const description = (path: string, status: string): string => (paths[path]!.post!.responses[status] as { description: string }).description
    expect(description('/api/newsletter/confirm', '400')).toContain('`invalidToken`: The token is missing.')
    expect(description('/api/newsletter/confirm', '404')).toContain('`notFound`: The token is unknown or malformed.')
    expect(description('/api/newsletter/unsubscribe', '400')).toContain('`invalidToken`: The token is missing or malformed.')
  })
})

describe('drift check', () => {
  function copyOfDocument(): { directory: string, file: string } {
    const directory = mkdtempSync(join(tmpdir(), 'openapi-'))
    const file = join(directory, 'openapi.json')
    cpSync(join(ROOT, 'docs/openapi.json'), file)
    return { directory, file }
  }

  it('accepts the committed document', () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
    expect(files.openApiProblems(ROOT, join(ROOT, 'docs/openapi.json'), version, manifest.ROUTES)).toEqual([])
  })

  it('says when only info.version differs', () => {
    const { directory, file } = copyOfDocument()
    try {
      expect(files.openApiProblems(ROOT, file, '99.0.0', manifest.ROUTES)).toEqual([expect.stringContaining('info.version')])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects a document that differs from the generated one, or is missing', () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
    const { directory, file } = copyOfDocument()
    try {
      writeFileSync(file, `${readFileSync(file, 'utf8').trimEnd()} \n`)
      expect(files.openApiProblems(ROOT, file, version, manifest.ROUTES)).toEqual([expect.stringContaining('npm run openapi')])
      expect(files.openApiProblems(ROOT, join(directory, 'missing.json'), version, manifest.ROUTES)).toEqual([expect.stringContaining('npm run openapi')])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
